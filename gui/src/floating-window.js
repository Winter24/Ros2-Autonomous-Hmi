import React from "react";

export default class FloatingWindow extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      x: props.x || 24,
      y: props.y || 24,
      width: props.width || 300,
      height: props.height || 220,
      dragging: false,
      resizing: false,
      collapsed: false
    };
  }

  componentDidMount() {
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  componentWillUnmount() {
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
  }

  toggleCollapse = () => {
    this.setState({ collapsed: !this.state.collapsed });
  };

  onDragStart = e => {
    if (this.state.collapsed) return;

    this.setState({
      dragging: true,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: this.state.x,
      startY: this.state.y
    });
  };

  onResizeStart = e => {
    e.stopPropagation();
    if (this.state.collapsed) return;

    this.setState({
      resizing: true,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: this.state.width,
      startHeight: this.state.height
    });
  };

  onMouseMove = e => {
    if (this.state.dragging) {
      this.setState({
        x: this.state.startX + e.clientX - this.state.startMouseX,
        y: this.state.startY + e.clientY - this.state.startMouseY
      });
    }

    if (this.state.resizing) {
      this.setState({
        width: Math.max(this.props.minWidth || 180, this.state.startWidth + e.clientX - this.state.startMouseX),
        height: Math.max(this.props.minHeight || 120, this.state.startHeight + e.clientY - this.state.startMouseY)
      });
    }
  };

  onMouseUp = () => {
    this.setState({ dragging: false, resizing: false });
  };

  renderCollapsed() {
  const side = this.props.collapseSide || "left";
  const title = this.props.title || "Window";

  const base = {
    position: "fixed",
    zIndex: this.props.zIndex || 9997,
    background: "rgba(25,28,34,0.92)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    fontWeight: "bold",
    cursor: "pointer",
    backdropFilter: "blur(8px)"
  };

  if (side === "bottom") {
    return (
      <div
        onClick={this.toggleCollapse}
        style={{
          ...base,
          left: this.state.x,
          bottom: 12,
          width: this.state.width,
          height: 42,
          borderRadius: "14px 14px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px"
        }}
      >
        <span>{title}</span>
        <span>＋</span>
      </div>
    );
  }

  if (side === "right") {
    return (
      <div
        onClick={this.toggleCollapse}
        style={{
          ...base,
          right: 0,
          top: this.state.y,
          width: 42,
          height: this.state.height,
          borderRadius: "14px 0 0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          writingMode: "vertical-rl",
          textOrientation: "mixed"
        }}
      >
        {title} ＋
      </div>
    );
  }

  return (
    <div
      onClick={this.toggleCollapse}
      style={{
        ...base,
        left: 0,
        top: this.state.y,
        width: 42,
        height: this.state.height,
        borderRadius: "0 14px 14px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        writingMode: "vertical-rl",
        textOrientation: "mixed"
      }}
    >
      {title} ＋
    </div>
  );
}

  render() {
    if (this.state.collapsed) {
      return this.renderCollapsed();
    }

    const { x, y, width, height } = this.state;

    return (
      <div style={{
        position: "fixed",
        left: x,
        top: y,
        width,
        height,
        zIndex: this.props.zIndex || 9997,
        background: "rgba(25,28,34,0.82)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        overflow: "hidden",
        backdropFilter: "blur(8px)"
      }}>
        <div
          onMouseDown={this.onDragStart}
          style={{
            height: "34px",
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white",
            fontWeight: "bold",
            cursor: "move",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          <span>{this.props.title}</span>

          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={this.toggleCollapse}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            −
          </button>
        </div>

        <div style={{ height: height - 34, overflow: "hidden" }}>
          {this.props.children}
        </div>

        <div
          onMouseDown={this.onResizeStart}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "18px",
            height: "18px",
            cursor: "nwse-resize",
            background: "rgba(255,255,255,0.25)"
          }}
        />
      </div>
    );
  }
}