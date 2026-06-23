import React from 'react';
import {
  MeterWidget,
  TurnSignalWidget,
  TrafficLightWidget
} from 'streetscape.gl';

import {
  METER_WIDGET_STYLE,
  TURN_SIGNAL_WIDGET_STYLE
} from './constants';

import FloatingWindow from "./floating-window";

const hudContainerStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "row",
  gap: "12px",
  padding: "10px",
  boxSizing: "border-box",
  alignItems: "stretch"
};

const hudCardStyle = {
  flex: 1,
  minWidth: "120px",

  background: "rgba(25, 28, 34, 0.78)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: "12px",

  padding: "8px",

  display: "flex",
  flexDirection: "column",

  boxShadow: "0 8px 24px rgba(0,0,0,0.25)"
};

const hudTitleStyle = {
  color: "#fff",
  fontSize: "12px",
  fontWeight: "bold",
  marginBottom: "6px",
  textAlign: "center",
  opacity: 0.85
};

export default class HUD extends React.PureComponent {
  render() {
    const { log } = this.props;

    return (
      <FloatingWindow
        title="Vehicle Status"
        x={560}
        y={735}
        width={620}
        height={220}
        minWidth={500}
        minHeight={180}
        collapseSide="bottom"
      >
        <div style={hudContainerStyle}>

          <div style={hudCardStyle}>
            <div style={hudTitleStyle}>Signal</div>

            <TurnSignalWidget
              log={log}
              style={TURN_SIGNAL_WIDGET_STYLE}
              streamName="/vehicle/turn_signal"
            />

            <TrafficLightWidget
              log={log}
              style={TURN_SIGNAL_WIDGET_STYLE}
              streamName="/vehicle/traffic_light"
            />
          </div>

          <div style={hudCardStyle}>
            <div style={hudTitleStyle}>Acceleration</div>

            <MeterWidget
              log={log}
              style={METER_WIDGET_STYLE}
              streamName="/vehicle/status/acceleration"
              units="m/s²"
              min={-4}
              max={4}
            />
          </div>

          <div style={hudCardStyle}>
            <div style={hudTitleStyle}>Speed</div>

            <MeterWidget
              log={log}
              style={METER_WIDGET_STYLE}
              streamName="/vehicle/status/velocity"
              units="m/s"
              min={0}
              max={20}
            />
          </div>

          <div style={hudCardStyle}>
            <div style={hudTitleStyle}>Steering</div>

            <MeterWidget
              log={log}
              style={METER_WIDGET_STYLE}
              streamName="/vehicle/status/steering_angle"
              units="deg"
              min={-45}
              max={45}
            />
          </div>

        </div>
      </FloatingWindow>
    );
  }
}