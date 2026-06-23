import React from 'react';
import {StreamSettingsPanel} from 'streetscape.gl';
import {Form, Button } from '@streetscape.gl/monochrome';
import DelayInfo from './delay_check-info'
import { APP_SETTINGS, CONFIG_SETTINGS} from './constants';

const POINTCLOUD_TOPICS = [
  "/kitti/point_cloud",
  "/unilidar/cloud",
  "/points_raw"
];

const settingsButtonStyle = {
  position: "fixed",
  right: "24px",
  bottom: "24px",
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  border: "none",
  background: "rgba(30, 30, 30, 0.95)",
  color: "white",
  fontSize: "24px",
  cursor: "pointer",
  zIndex: 9999
};

const settingsPopupStyle = {
  position: "fixed",
  right: "24px",
  bottom: "92px",
  width: "340px",
  maxHeight: "75vh",
  overflowY: "auto",
  background: "rgba(35, 35, 35, 0.96)",
  color: "white",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  zIndex: 9998
};

const sectionTitleStyle = {
  fontWeight: "bold",
  marginBottom: "8px"
};

export default class ControlPanel extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      pointCloudTopic: "/kitti/point_cloud",
      pointCloudStatus: "default",
      showSettings: false
    };

    this.onPointCloudTopicChange = this.onPointCloudTopicChange.bind(this);
    this.toggleSettings = this.toggleSettings.bind(this);
  }

  toggleSettings() {
    this.setState({
      showSettings: !this.state.showSettings
    });
  }

  onPointCloudTopicChange(event) {
    const topic = event.target.value;

    this.setState({
      pointCloudTopic: topic,
      pointCloudStatus: "switching..."
    });

    fetch("http://localhost:8082/set_pointcloud_topic", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({topic})
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          this.setState({
            pointCloudStatus: `active: ${data.topic}`
          });
        } else {
          this.setState({
            pointCloudStatus: `error: ${data.error || "unknown"}`
          });
        }
      })
      .catch(err => {
        this.setState({
          pointCloudStatus: `error: ${err.message}`
        });
      });
  }

  renderSettingsPopup() {
    const {log, state, settings, onSettingsChange, onChange, onClick} = this.props;

    return (
      <div style={settingsPopupStyle}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px"
        }}>
          <div style={{fontSize: "18px", fontWeight: "bold"}}>
            Settings
          </div>

          <button
            onClick={this.toggleSettings}
            style={{
              background: "transparent",
              color: "white",
              border: "none",
              fontSize: "20px",
              cursor: "pointer"
            }}
          >
            ×
          </button>
        </div>

        <hr />

        <DelayInfo log={log} state={state} />

        <hr />

        <div style={sectionTitleStyle}>View Settings</div>
        <Form
          data={APP_SETTINGS}
          values={settings}
          onChange={onSettingsChange}
        />

        <hr />

        <div style={sectionTitleStyle}>PointCloud Topic</div>

        <select
          value={this.state.pointCloudTopic}
          onChange={this.onPointCloudTopicChange}
          style={{
            width: "100%",
            background: "#333",
            color: "#fff",
            border: "1px solid #777",
            padding: "6px"
          }}
        >
          {POINTCLOUD_TOPICS.map(topic => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>

        <div style={{
          fontSize: "12px",
          color: "#aaa",
          marginTop: "6px",
          wordBreak: "break-all"
        }}>
          {this.state.pointCloudStatus}
        </div>

        <hr />

        <div style={sectionTitleStyle}>Connection</div>
        <Form
          data={CONFIG_SETTINGS}
          values={state}
          onChange={onChange}
        />

        <hr />

        <details>
          <summary style={{
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: "8px"
          }}>
            Stream / Layer Settings
          </summary>

          <div style={{marginTop: "10px"}}>
            <StreamSettingsPanel
              log={log}
              onSettingsChange={this.props.onStreamSettingChange}
            />
          </div>
        </details>

        <hr />

        <Button onClick={onClick}>
          Re-Connect
        </Button>
      </div>
    );
  }

  render() {
    return (
      <div>
        {this.state.showSettings && this.renderSettingsPopup()}

        <button
          onClick={this.toggleSettings}
          style={settingsButtonStyle}
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    );
  }
}