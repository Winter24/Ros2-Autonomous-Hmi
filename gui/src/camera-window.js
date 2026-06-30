import React from "react";
import ROSLIB from "roslib";
import FloatingWindow from "./floating-window";

export default class CameraWindow extends React.PureComponent {
  constructor(props) {
    super(props);

    this.canvasRef = React.createRef();

    this.state = {
      cameraTopicName: "unknown",
      errorText: null
    };

    this.ros = new ROSLIB.Ros({
      url: "ws://localhost:9090"
    });

    this.cameraTopic = null;
    this.cameraTopicName = null;
    this.topicPollTimer = null;
  }

  componentDidMount() {
    this.updateCameraSubscription();
    this.topicPollTimer = setInterval(this.updateCameraSubscription, 1000);
  }

  componentWillUnmount() {
    if (this.topicPollTimer) clearInterval(this.topicPollTimer);
    if (this.cameraTopic) this.cameraTopic.unsubscribe();
    if (this.ros) this.ros.close();
  }

  getCameraTopicByPointCloudTopic(pointCloudTopic) {
    if (pointCloudTopic === "/points_raw") {
      return {
        name: "/camera/camera/image_raw",
        type: "sensor_msgs/msg/Image"
      };
    }

    return {
      name: "/kitti/image/color/left/compressed",
      type: "sensor_msgs/msg/CompressedImage"
    };
  }

  updateCameraSubscription = () => {
    fetch("http://localhost:8082/pointcloud_topic")
      .then(res => res.json())
      .then(data => {
        if (!data.ok) return;

        const cameraConfig =
          this.getCameraTopicByPointCloudTopic(data.topic);

        if (this.cameraTopicName === cameraConfig.name) return;

        if (this.cameraTopic) {
          this.cameraTopic.unsubscribe();
          this.cameraTopic = null;
        }

        this.cameraTopicName = cameraConfig.name;

        this.setState({
          cameraTopicName: cameraConfig.name,
          errorText: null
        });

        this.cameraTopic = new ROSLIB.Topic({
          ros: this.ros,
          name: cameraConfig.name,
          messageType: cameraConfig.type
        });

        this.cameraTopic.subscribe(msg => {
          this.drawRawImage(msg);
        });

        console.log("[CAMERA] subscribed:", cameraConfig.name);
      })
      .catch(err => {
        this.setState({ errorText: err.message });
      });
  };

  base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  drawRawImage(msg) {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    if (msg.format && (msg.format.includes("jpeg") || msg.format.includes("jpg") || msg.format.includes("png"))) {
      const dataUrl = `data:image/jpeg;base64,` + msg.data;
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        this.setState({ errorText: null });
      };
      img.onerror = () => {
        this.setState({ errorText: "Failed to load compressed image" });
      };
      img.src = dataUrl;
      return;
    }

    const width = msg.width;
    const height = msg.height;
    const encoding = msg.encoding || "rgb8";

    if (!width || !height || !msg.data) {
      this.setState({ errorText: "Invalid image message" });
      return;
    }

    const raw = this.base64ToUint8Array(msg.data);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const out = imageData.data;

    const isBGR = encoding === "bgr8" || encoding === "bgra8";
    const isRGB = encoding === "rgb8" || encoding === "rgba8";
    const isMono = encoding === "mono8" || encoding === "8UC1";
    const hasAlpha = encoding === "rgba8" || encoding === "bgra8";

    if (isMono) {
      for (let i = 0; i < width * height; i++) {
        const v = raw[i];
        out[i * 4] = v;
        out[i * 4 + 1] = v;
        out[i * 4 + 2] = v;
        out[i * 4 + 3] = 255;
      }
    } else if (isRGB || isBGR) {
      const step = Math.round(raw.length / (width * height));

      for (let i = 0; i < width * height; i++) {
        const src = i * step;
        const dst = i * 4;

        if (isBGR) {
          out[dst] = raw[src + 2];
          out[dst + 1] = raw[src + 1];
          out[dst + 2] = raw[src];
        } else {
          out[dst] = raw[src];
          out[dst + 1] = raw[src + 1];
          out[dst + 2] = raw[src + 2];
        }

        out[dst + 3] = 255;
      }
    } else {
      this.setState({
        errorText: `Unsupported encoding: ${encoding}`
      });
      return;
    }

    ctx.putImageData(imageData, 0, 0);
    this.setState({ errorText: null });
  }

  render() {
    return (
      <FloatingWindow
        title="Camera"
        x={24}
        y={430}
        width={420}
        height={290}
        minWidth={260}
        minHeight={180}
        collapseSide="left"
      >
        <div style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#111"
        }}>
          <canvas
            ref={this.canvasRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }}
          />

          <div style={{
            position: "absolute",
            left: "8px",
            bottom: "8px",
            padding: "4px 8px",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: "11px",
            borderRadius: "6px"
          }}>
            {this.state.cameraTopicName}
          </div>

          {this.state.errorText && (
            <div style={{
              position: "absolute",
              right: "8px",
              bottom: "8px",
              color: "#ff7777",
              fontSize: "11px"
            }}>
              {this.state.errorText}
            </div>
          )}
        </div>
      </FloatingWindow>
    );
  }
}