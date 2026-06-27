const ROSLIB = require("roslib");
const xvizServer = require("./xviz-server");
const Parser = require("binary-parser").Parser;
const parser = new Parser().floatle();
const toUint8Array = require("base64-to-uint8array");
const utmConverter = require("utm-latlng");
const { Vector3, _Euler } = require("math.gl");
const _ = require("lodash");
var math = require("math.gl");

const ImageConverter = require("./XVIZ_Converter/xviz-image_converter");
const LidarConverter = require("./XVIZ_Converter/xviz-lidar_converter");
const ObjConveter = require("./XVIZ_Converter/xviz-object_converter");
const Calculator = require("./Calculator");

const object_transform_helper = require("./XVIZ_Converter/xviz-object_coordinate_transform");

const http = require("http");

let pointCloudTopicName = "/kitti/point_cloud";
let pointCloudListener = null;

function usingSimulationPose() {
  return pointCloudTopicName === "/points_raw";
}

function usingKittiPose() {
  return pointCloudTopicName === "/kitti/point_cloud";
}

function getPoseYawOffsetByPointCloudTopic() {
  if (pointCloudTopicName === "/points_raw") {
    return Math.PI;
  }

  return 0.0;
}

function rotatePointCloudZ(points, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  if (!points || points.length === 0) {
    return points;
  }

  if (Array.isArray(points[0])) {
    return points.map(p => {
      const x = p[0];
      const y = p[1];

      return [
        c * x - s * y,
        s * x + c * y,
        p[2]
      ];
    });
  }

  const out = points.slice();

  for (let i = 0; i < out.length; i += 3) {
    const x = out[i];
    const y = out[i + 1];

    out[i] = c * x - s * y;
    out[i + 1] = s * x + c * y;
  }

  return out;
}

var utmobj = new utmConverter();
let car_pos_utm = { x: 0, y: 0, z: 0 };
let localPath_marker = null;

let longitude = 0;
let latitude = 0;

let roll = null;
let yaw = null;
let pitch = null;

let x_dir_velocity = 0;
let x_dir_acl = 0;
let steering_degree = 0;

let pointcloud = null;

const rosBridgeClient = new ROSLIB.Ros({
  url: "ws://localhost:9090"
});

function handlePointCloudMessage(message) {
  pointcloud = message.is_dense;

  const load_lidar_data_return = LidarConverter.load_lidar_data(message);

  let positions = load_lidar_data_return[0];
  const colors = load_lidar_data_return[1];

  if (pointCloudTopicName === "/points_raw") {
    positions = rotatePointCloudZ(positions, Math.PI / 2.0);
  }

  xvizServer.updateLidar(positions, colors);

  const timestamp =
    `${message.header.stamp.secs || message.header.stamp.sec}.` +
    `${message.header.stamp.nsecs || message.header.stamp.nanosec}`;

  xvizServer.updateLocation(
    latitude,
    longitude,
    0,
    roll || 0,
    pitch || 0,
    yaw || 0,
    x_dir_velocity,
    steering_degree,
    x_dir_acl,
    parseFloat(timestamp),
    getPoseYawOffsetByPointCloudTopic()
  );
}

function subscribePointCloudTopic(topicName) {
  if (pointCloudListener) {
    pointCloudListener.unsubscribe();
    console.log("[POINTCLOUD] unsubscribed old topic");
  }

  pointCloudTopicName = topicName;

  pointCloudListener = new ROSLIB.Topic({
    ros: rosBridgeClient,
    name: pointCloudTopicName,
    messageType: "sensor_msgs/msg/PointCloud2",
    throttle_rate: 150
  });

  pointCloudListener.subscribe(handlePointCloudMessage);

  console.log("[POINTCLOUD] subscribed:", pointCloudTopicName);
}

const listener = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/kitti/nav_sat_fix",
  messageType: "sensor_msgs/msg/NavSatFix"
});

const listener2 = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/kitti/imu",
  messageType: "sensor_msgs/msg/Imu"
});

const odomListener = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/odom",
  messageType: "nav_msgs/msg/Odometry"
});

const listener7 = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/camera/camera/image_raw",
  messageType: "sensor_msgs/msg/Image",
  throttle_rate: 100
});

const listener8 = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/kitti/marker_array",
  messageType: "visualization_msgs/msg/MarkerArray"
});

const predListener = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: "/preds",
  messageType: "vision_msgs/msg/Detection3DArray",
  throttle_rate: 100
});

xvizServer.startListenOn(8081);

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

rosBridgeClient.on("connection", function () {
  console.log("Connected to rosbridge websocket server.");
  subscribePointCloudTopic(pointCloudTopicName);
  predListener.subscribe(handlePredsMessage);
  console.log("[PREDS] subscribed to /preds");
});

rosBridgeClient.on("error", function (error) {
  console.log("Error connecting to rosbridge websocket server: ", error);
});

rosBridgeClient.on("close", function () {
  console.log("Connection to rosbridge websocket server closed.");
});

const topicApiServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/set_pointcloud_topic") {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        if (!data.topic || typeof data.topic !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing topic" }));
          return;
        }

        subscribePointCloudTopic(data.topic);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          topic: pointCloudTopicName
        }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: false,
          error: err.message
        }));
      }
    });

    return;
  }

const enableDetectionPub = new ROSLIB.Topic({
  ros: rosBridgeClient,
  name: '/enable_detection',
  messageType: 'std_msgs/msg/Bool'
});

  if (req.method === "POST" && req.url === "/toggle_predictions") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        enablePredictions = !!data.enable;
        
        // Tell detect.py to wake up or go to sleep
        enableDetectionPub.publish(new ROSLIB.Message({ data: enablePredictions }));
        
        if (!enablePredictions) {
          xvizServer.updateObstacles([{
            id: 9999,
            object_class: 0,
            object_build: '0',
            vertices: { x: 0, y: 0, z: -10000 },
            scale: { x: 0.01, y: 0.01, z: 0.01 },
            orientation: { car_roll: 0, car_pitch: 0, car_yaw: 0, roll: 0, pitch: 0, yaw: 0, yaw_: 0 },
            velocity: { dir_arrow: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], abs_velocity: 0 }
          }]);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, enablePredictions }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/pointcloud_topic") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      topic: pointCloudTopicName
    }));
    return;
  }

  res.writeHead(404);
  res.end();
});

topicApiServer.listen(8082, () => {
  console.log("[API] PointCloud topic API running on http://localhost:8082");
});

listener.subscribe(function (message) {
  if (!usingKittiPose()) {
    return;
  }

  const timestamp =
    `${message.header.stamp.secs || message.header.stamp.sec}.` +
    `${message.header.stamp.nsecs || message.header.stamp.nanosec}`;

  latitude = message.latitude;
  longitude = message.longitude;

  xvizServer.updateLocation(
    latitude,
    longitude,
    0,
    roll || 0,
    pitch || 0,
    yaw || 0,
    x_dir_velocity,
    steering_degree,
    x_dir_acl,
    parseFloat(timestamp),
    getPoseYawOffsetByPointCloudTopic()
  );
});

listener2.subscribe(function (message) {
  if (!usingKittiPose()) {
    return;
  }

  if (message.orientation) {
    const vehicle_heading_list =
      Calculator.QuaternionToRoll_Pitch_Yaw(message.orientation);

    roll = vehicle_heading_list[0];
    pitch = vehicle_heading_list[1];
    yaw = vehicle_heading_list[2];
  }
});

odomListener.subscribe(function (message) {
  if (!usingSimulationPose()) {
    return;
  }

  const q = message.pose.pose.orientation;
  const rpy = Calculator.QuaternionToRoll_Pitch_Yaw(q);

  roll = rpy[0];
  pitch = rpy[1];
  yaw = rpy[2];

  const v = message.twist.twist.linear;
  x_dir_velocity = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  const timestamp =
    `${message.header.stamp.secs || message.header.stamp.sec}.` +
    `${message.header.stamp.nsecs || message.header.stamp.nanosec}`;

  // console.log("[SIM ODOM] yaw=", yaw * 180.0 / Math.PI);

  xvizServer.updateLocation(
    latitude,
    longitude,
    0,
    roll || 0,
    pitch || 0,
    yaw || 0,
    x_dir_velocity,
    steering_degree,
    x_dir_acl,
    parseFloat(timestamp),
    getPoseYawOffsetByPointCloudTopic()
  );
});

// listener7.subscribe(function (message) {
//   console.log(`[CAMERA] Received image: ${message.width}x${message.height}, encoding: ${message.encoding}, data length: ${message.data.length}`);
//   const data_ = toUint8Array(message.data);
//   const data = Buffer.from(data_);
//   ImageConverter.createSharpImg(data, message.width, message.height, message.encoding).catch(err => {
//     console.error("[CAMERA] sharp error:", err);
//   });
// });

function mapClassId(classIdStr) {
  const classId = parseInt(classIdStr);
  switch (classId) {
    case 0: return 6; // Pedestrian -> PEDESTRIAN
    case 1: return 4; // Bicycle -> BICYCLE
    case 2: return 5; // Motorcycle -> MOTORBIKE
    case 3: return 5; // Scooter -> MOTORBIKE
    default: return 0; // UNKNOWN
  }
}

let enablePredictions = true;
let lastPredTime = 0;

setInterval(() => {
  if (enablePredictions && Date.now() - lastPredTime > 1000) {
    xvizServer.updateObstacles([{
      id: 9999,
      object_class: 0,
      object_build: '0',
      vertices: { x: 0, y: 0, z: -10000 },
      scale: { x: 0.01, y: 0.01, z: 0.01 },
      orientation: { car_roll: 0, car_pitch: 0, car_yaw: 0, roll: 0, pitch: 0, yaw: 0, yaw_: 0 },
      velocity: { dir_arrow: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], abs_velocity: 0 }
    }]);
  }
}, 500);

function handlePredsMessage(message) {
  lastPredTime = Date.now();
  if (!enablePredictions || !message.detections) {
    return;
  }

  const obstacles = message.detections.map((detection, idx) => {
    let posX = detection.bbox.center.position.x;
    let posY = detection.bbox.center.position.y;
    let posZ = detection.bbox.center.position.z;

    let rpy = [0, 0, 0];
    if (detection.bbox.center.orientation) {
      rpy = Calculator.QuaternionToRoll_Pitch_Yaw(detection.bbox.center.orientation);
    }
    let objYaw = rpy[2];

    if (usingSimulationPose()) {
      // Rotate position by PI/2 around Z-axis: (x', y') = (-y, x)
      const tempX = posX;
      posX = -posY;
      posY = tempX;
      objYaw += Math.PI / 2.0;
    }

    const xviz_class = mapClassId(detection.results[0]?.hypothesis?.class_id || '0');
    const object_build = xviz_class === 6 ? '1' : '0'; // '1' Cylinder for pedestrian, '0' CubeBox for others

    return {
      id: idx + 1,
      object_class: xviz_class,
      object_build: object_build,
      vertices: {
        x: posX,
        y: posY,
        z: posZ
      },
      scale: {
        x: detection.bbox.size.x,
        y: detection.bbox.size.y,
        z: detection.bbox.size.z
      },
      orientation: {
        car_roll: 0,
        car_pitch: 0,
        car_yaw: 0,
        roll: rpy[0],
        pitch: rpy[1],
        yaw: objYaw,
        yaw_: objYaw
      },
      velocity: {
        dir_arrow: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
        abs_velocity: 0
      }
    };
  });

  if (obstacles.length === 0) {
    xvizServer.updateObstacles([{
      id: 9999,
      object_class: 0,
      object_build: '0',
      vertices: { x: 0, y: 0, z: -10000 },
      scale: { x: 0.01, y: 0.01, z: 0.01 },
      orientation: { car_roll: 0, car_pitch: 0, car_yaw: 0, roll: 0, pitch: 0, yaw: 0, yaw_: 0 },
      velocity: { dir_arrow: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], abs_velocity: 0 }
    }]);
  } else {
    xvizServer.updateObstacles(obstacles);
  }
}

function gracefulShutdown() {
  console.log("shutting down rosbridge-xviz-connector");

  listener.unsubscribe();
  listener2.unsubscribe();
  odomListener.unsubscribe();

  if (pointCloudListener) {
    pointCloudListener.unsubscribe();
  }

  listener7.unsubscribe();
  listener8.unsubscribe();
  predListener.unsubscribe();

  rosBridgeClient.close();
  xvizServer.close();

  if (topicApiServer) {
    topicApiServer.close();
  }

  setTimeout(() => {
    process.exit(0);
  }, 300);
}

function sleep(delay) {
  var start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}

function requestAnimFrame() {
  if (!lastCalledTime) {
    lastCalledTime = Date.now();
    fps = 0;
    return;
  }

  delta = (Date.now() - lastCalledTime) / 1000;
  lastCalledTime = Date.now();
  fps = 1 / delta;
}