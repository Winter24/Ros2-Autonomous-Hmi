import React from "react";
import ROSLIB from "roslib";
import FloatingWindow from "./floating-window";

const MAP_CONFIG = {
  image: "/assets/small_city.png",
  resolution: 0.05,
  originX: -200.0,
  originY: -70.0,
  width: 8000,
  height: 2800,

  // Nếu hướng map sai, đổi CCW <-> CW
  rotation: "CCW"
};

export default class MiniMapWindow extends React.PureComponent {
  constructor(props) {
    super(props);

    this.canvasRef = React.createRef();

    this.state = {
      odomMsg: null,
      planMsg: null,
      mapLoaded: false
    };

    this.ros = new ROSLIB.Ros({
      url: "ws://localhost:9090"
    });

    this.mapImage = new Image();
    this.mapImage.onload = () => {
      this.setState({ mapLoaded: true }, this.draw);
    };
    this.mapImage.onerror = () => {
      console.error("Failed to load minimap image:", MAP_CONFIG.image);
    };
    this.mapImage.src = MAP_CONFIG.image;
  }

  componentDidMount() {
    window.addEventListener("resize", this.draw);

    this.odomTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: "/odom",
      messageType: "nav_msgs/msg/Odometry"
    });

    this.planTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: "/plan",
      messageType: "nav_msgs/msg/Path"
    });

    this.goalTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: "/goal_pose",
      messageType: "geometry_msgs/msg/PoseStamped"
    });

    this.odomTopic.subscribe(msg => {
      this.setState({ odomMsg: msg }, this.draw);
    });

    this.planTopic.subscribe(msg => {
      this.setState({ planMsg: msg }, this.draw);
    });

    this.draw();
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.draw);

    if (this.odomTopic) this.odomTopic.unsubscribe();
    if (this.planTopic) this.planTopic.unsubscribe();
    if (this.ros) this.ros.close();
  }

  getCanvasSize() {
    const canvas = this.canvasRef.current;
    if (!canvas) return { width: 1, height: 1 };

    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
  }

  getMapDrawParams() {
    const { width, height } = this.getCanvasSize();

    // Sau khi xoay 90 độ: display width = map height, display height = map width
    const displayMapW = MAP_CONFIG.height;
    const displayMapH = MAP_CONFIG.width;

    const s = Math.min(width / displayMapW, height / displayMapH);

    const padX = (width - displayMapW * s) / 2;
    const padY = (height - displayMapH * s) / 2;

    return {
      width,
      height,
      s,
      padX,
      padY,
      displayMapW,
      displayMapH
    };
  }

  mapPixelToDisplay(mapU, mapV) {
    const { s, padX, padY } = this.getMapDrawParams();
    const mw = MAP_CONFIG.width;
    const mh = MAP_CONFIG.height;

    let du;
    let dv;

    if (MAP_CONFIG.rotation === "CW") {
      du = mh - mapV;
      dv = mapU;
    } else {
      du = mapV;
      dv = mw - mapU;
    }

    return {
      u: padX + du * s,
      v: padY + dv * s
    };
  }

  displayToMapPixel(u, v) {
    const { s, padX, padY } = this.getMapDrawParams();
    const mw = MAP_CONFIG.width;
    const mh = MAP_CONFIG.height;

    const du = (u - padX) / s;
    const dv = (v - padY) / s;

    let mapU;
    let mapV;

    if (MAP_CONFIG.rotation === "CW") {
      mapU = dv;
      mapV = mh - du;
    } else {
      mapU = mw - dv;
      mapV = du;
    }

    return { mapU, mapV };
  }

  rosToCanvas(x, y) {
    const mapU = (x - MAP_CONFIG.originX) / MAP_CONFIG.resolution;
    const mapV =
      MAP_CONFIG.height -
      (y - MAP_CONFIG.originY) / MAP_CONFIG.resolution;

    return this.mapPixelToDisplay(mapU, mapV);
  }

  canvasToRos(u, v) {
    const { mapU, mapV } = this.displayToMapPixel(u, v);

    const x = MAP_CONFIG.originX + mapU * MAP_CONFIG.resolution;
    const y =
      MAP_CONFIG.originY +
      (MAP_CONFIG.height - mapV) * MAP_CONFIG.resolution;

    return { x, y };
  }

  yawFromQuat(q) {
    return Math.atan2(
      2.0 * (q.w * q.z + q.x * q.y),
      1.0 - 2.0 * (q.y * q.y + q.z * q.z)
    );
  }

  rotateYawForDisplay(yaw) {
    // Nếu mũi tên lệch 90 độ, thử:
    // return -yaw + Math.PI / 2.0;
    // hoặc return -yaw - Math.PI / 2.0;
    return -yaw;
  }

  draw = () => {
    const canvas = this.canvasRef.current;
    const { odomMsg, planMsg, mapLoaded } = this.state;

    if (!canvas) return;

    const { width, height } = this.getCanvasSize();

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(245,248,255,0.95)";
    ctx.fillRect(0, 0, width, height);

    const { s, padX, padY } = this.getMapDrawParams();

    if (!mapLoaded) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.fillText("Loading map image ...", 16, 30);
      return;
    }

    ctx.save();

    if (MAP_CONFIG.rotation === "CW") {
      ctx.translate(padX + MAP_CONFIG.height * s, padY);
      ctx.rotate(Math.PI / 2.0);
    } else {
      ctx.translate(padX, padY + MAP_CONFIG.width * s);
      ctx.rotate(-Math.PI / 2.0);
    }

    ctx.drawImage(
      this.mapImage,
      0,
      0,
      MAP_CONFIG.width * s,
      MAP_CONFIG.height * s
    );

    ctx.restore();

    if (planMsg && planMsg.poses && planMsg.poses.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#00a8ff";
      ctx.lineWidth = 3;

      planMsg.poses.forEach((ps, idx) => {
        const p = ps.pose.position;
        const c = this.rosToCanvas(p.x, p.y);

        if (idx === 0) ctx.moveTo(c.u, c.v);
        else ctx.lineTo(c.u, c.v);
      });

      ctx.stroke();
    }

    if (odomMsg) {
      const p = odomMsg.pose.pose.position;
      const q = odomMsg.pose.pose.orientation;
      const yaw = this.yawFromQuat(q);
      const c = this.rosToCanvas(p.x, p.y);

      ctx.save();
      ctx.translate(c.u, c.v);
      ctx.rotate(this.rotateYawForDisplay(yaw));

      ctx.fillStyle = "#ff3333";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-9, -7);
      ctx.lineTo(-9, 7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  };

  onCanvasClick = e => {
    const rect = this.canvasRef.current.getBoundingClientRect();
    const u = e.clientX - rect.left;
    const v = e.clientY - rect.top;

    const p = this.canvasToRos(u, v);
    if (!p) return;

    const goal = new ROSLIB.Message({
      header: {
        frame_id: "map"
      },
      pose: {
        position: {
          x: p.x,
          y: p.y,
          z: 0.0
        },
        orientation: {
          x: 0.0,
          y: 0.0,
          z: 0.0,
          w: 1.0
        }
      }
    });

    this.goalTopic.publish(goal);
    console.log("Published /goal_pose:", p);
  };

  render() {
    return (
      <FloatingWindow
        title="Local Map"
        x={24}
        y={24}
        width={420}
        height={390}
        minWidth={220}
        minHeight={260}
        collapseSide="left"
      >
        <canvas
          ref={this.canvasRef}
          onClick={this.onCanvasClick}
          style={{
            width: "100%",
            height: "100%",
            cursor: "crosshair",
            display: "block",
            background: "rgba(245,248,255,0.95)"
          }}
        />
      </FloatingWindow>
    );
  }
}