const LitElement = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const COLORS = {
  red: "rgb(211, 47, 47)",
  orange: "rgb(255, 87, 34)",
  amber: "rgb(255, 193, 7)",
  lightGreen: "rgb(139, 195, 74)",
  green: "rgb(76, 175, 80)",
  teal: "rgb(0, 150, 136)",
  blue: "rgb(25, 118, 210)"
};

// Exact mapping of Recommendation 1 thresholds
const SCALES = {
  down: { 
    max: 1000, 
    segments: [
      { c: COLORS.red, min: 0, max: 20 },
      { c: COLORS.orange, min: 20, max: 50 },
      { c: COLORS.amber, min: 50, max: 100 },
      { c: COLORS.lightGreen, min: 100, max: 300 },
      { c: COLORS.green, min: 300, max: 500 },
      { c: COLORS.teal, min: 500, max: 800 },
      { c: COLORS.blue, min: 800, max: 1000 }
    ]
  },
  up: { 
    max: 500, 
    segments: [
      { c: COLORS.red, min: 0, max: 5 },
      { c: COLORS.orange, min: 5, max: 15 },
      { c: COLORS.amber, min: 15, max: 30 },
      { c: COLORS.lightGreen, min: 30, max: 75 },
      { c: COLORS.green, min: 75, max: 150 },
      { c: COLORS.teal, min: 150, max: 300 },
      { c: COLORS.blue, min: 300, max: 500 }
    ]
  },
  ping: { 
    max: 350, 
    segments: [
      { c: COLORS.blue, min: 0, max: 15 },
      { c: COLORS.teal, min: 15, max: 30 },
      { c: COLORS.green, min: 30, max: 60 },
      { c: COLORS.lightGreen, min: 60, max: 100 },
      { c: COLORS.amber, min: 100, max: 150 },
      { c: COLORS.orange, min: 150, max: 250 },
      { c: COLORS.red, min: 250, max: 350 }
    ]
  }
};

class OmnilisticSpeedtest extends LitElement {
  static get properties() {
    return { 
      hass: { type: Object }, 
      config: { type: Object }, 
      _isUpdating: { type: Boolean },
      _currentIcon: { type: String }
    };
  }

  constructor() {
    super();
    this._isUpdating = false;
    this._lastValues = { down: null, up: null, ping: null };
    this._currentIcon = "mdi:play-speed";
    this._animationInterval = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._animationInterval) {
      clearInterval(this._animationInterval);
    }
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this._isUpdating) {
      const down = this.hass.states[this.config.download_entity]?.state;
      const up = this.hass.states[this.config.upload_entity]?.state;
      const ping = this.hass.states[this.config.ping_entity]?.state;
      
      if (down !== this._lastValues.down || up !== this._lastValues.up || ping !== this._lastValues.ping) {
        this._isUpdating = false;
        clearInterval(this._animationInterval);
        this._currentIcon = "mdi:play-speed";
      }
    }
  }

  _getCurrentColor(val, type) {
    const segments = SCALES[type].segments;
    for (let seg of segments) {
      if (val <= seg.max) return seg.c;
    }
    return segments[segments.length - 1].c;
  }

  _renderGauge(stateObj, label, defaultIcon, unit, type) {
    const val = stateObj ? parseFloat(stateObj.state) : 0;
    const max = SCALES[type].max;
    const pct = Math.min(Math.max(val / max, 0), 1);
    const customIcon = this.config[`${type}_icon`];
    const currentColor = this._getCurrentColor(val, type);

    const paths = SCALES[type].segments.map(seg => {
      const pStart = seg.min / max;
      const pEnd = seg.max / max;
      return {
        c: seg.c,
        dasharray: `${(pEnd - pStart) * 182} 182`,
        dashoffset: `${-pStart * 182}`
      };
    });

    return html`
      <div class="gauge-container">
        <div class="gauge-visual">
          <svg viewBox="0 0 100 85">
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[0].c}" stroke-dasharray="${paths[0].dasharray}" stroke-dashoffset="${paths[0].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[1].c}" stroke-dasharray="${paths[1].dasharray}" stroke-dashoffset="${paths[1].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[2].c}" stroke-dasharray="${paths[2].dasharray}" stroke-dashoffset="${paths[2].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[3].c}" stroke-dasharray="${paths[3].dasharray}" stroke-dashoffset="${paths[3].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[4].c}" stroke-dasharray="${paths[4].dasharray}" stroke-dashoffset="${paths[4].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[5].c}" stroke-dasharray="${paths[5].dasharray}" stroke-dashoffset="${paths[5].dashoffset}" />
            <path class="track-segment" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="1.5" stroke="${paths[6].c}" stroke-dasharray="${paths[6].dasharray}" stroke-dashoffset="${paths[6].dashoffset}" />

            <path class="fill" d="M 20 75 A 40 40 0 1 1 80 75" fill="none" stroke-width="6" stroke="${currentColor}" stroke-dasharray="182" stroke-dashoffset="${182 - (pct * 182)}" />
          </svg>
          <ha-icon class="gauge-icon" icon="${customIcon || defaultIcon}" style="color: ${currentColor}"></ha-icon>
        </div>
        <div class="info">
          <div class="value-row"><span class="num">${val}</span><span class="unit">${unit}</span></div>
          <div class="label">${label}</div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.config || !this.hass) return html``;
    
    const cardStyle = this.config.background_color ? `background-color: ${this.config.background_color}; border-color: transparent;` : '';

    return html`
      <ha-card style="${cardStyle}">
        <div class="header" @click="${this._runTest}">
          <ha-icon icon="${this._currentIcon}" class="${this._isUpdating ? 'running' : ''}"></ha-icon>
          <span class="title">${this.config.name || 'Speedtest'}</span>
        </div>
        <div class="metrics-row">
          ${this._renderGauge(this.hass.states[this.config.download_entity], "download", "fapro:progress-download", "Mb", "down")}
          ${this._renderGauge(this.hass.states[this.config.upload_entity], "upload", "fapro:progress-upload", "Mb", "up")}
          ${this._renderGauge(this.hass.states[this.config.ping_entity], "ping", "fapro:globe", "Ms", "ping")}
        </div>
      </ha-card>
    `;
  }

  _runTest() {
    if (this.config.script_entity && !this._isUpdating) {
      // Trigger Medium Haptics
      this.dispatchEvent(new CustomEvent("haptic", { detail: "medium", bubbles: true, composed: true }));

      this._lastValues = {
        down: this.hass.states[this.config.download_entity]?.state,
        up: this.hass.states[this.config.upload_entity]?.state,
        ping: this.hass.states[this.config.ping_entity]?.state,
      };
      this._isUpdating = true;

      const animationIcons = ["mdi:speedometer-slow", "mdi:speedometer-medium", "mdi:speedometer"];
      let i = 0;
      this._currentIcon = animationIcons[i];
      
      this._animationInterval = setInterval(() => {
        i = (i + 1) % animationIcons.length;
        this._currentIcon = animationIcons[i];
      }, 400); 

      this.hass.callService("script", "turn_on", { entity_id: this.config.script_entity });
    }
  }

  setConfig(config) { this.config = config; }

  static get styles() {
    return css`
      ha-card { 
        padding: 16px; 
        font-family: var(--paper-font-body1_-_font-family); 
        container-type: inline-size; 
        transition: background-color 0.3s;
      }
      .header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; cursor: pointer; } 
      
      .header ha-icon { --mdc-icon-size: clamp(20px, 8cqi, 32px); transition: color 0.3s; }
      .title { font-size: clamp(0.7rem, 4cqi, 1rem); font-weight: 500; color: var(--primary-text-color); }
      
      .running { color: var(--primary-color); } 

      .metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .gauge-container { display: flex; flex-direction: column; align-items: center; }
      .gauge-visual { position: relative; width: 100%; max-width: 90px; }
      
      .track-segment { stroke-linecap: butt; opacity: 0.35; }
      .fill { stroke-linecap: round; transition: stroke-dashoffset 2s ease-in-out, stroke 0.5s; }
      
      .gauge-icon { 
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
        --mdc-icon-size: clamp(22px, 11cqi, 44px); 
        transition: color 0.5s; 
      } 
      .info { text-align: center; margin-top: -12px; line-height: 1; } 
      .num { font-size: clamp(0.6rem, 3.6cqi, 0.9rem); font-weight: 400; color: var(--primary-text-color); }
      .unit { font-size: clamp(0.4rem, 2.4cqi, 0.6rem); font-weight: 300; opacity: 0.6; margin-left: 2px; }
      .label { font-size: clamp(0.45rem, 2.6cqi, 0.65rem); font-weight: 400; text-transform: uppercase; opacity: 0.7; margin-top: 2px; }
    `;
  }

  static getConfigElement() { return document.createElement("omnilistic-speedtest-editor"); }
}

if (!customElements.get("omnilistic-speedtest")) {
  customElements.define("omnilistic-speedtest", OmnilisticSpeedtest);
}

// --- UI EDITOR ---
class OmnilisticEditor extends LitElement {
  static get properties() { return { hass: { type: Object }, _config: { type: Object } }; }
  
  setConfig(config) { this._config = config; }
  
  render() {
    if (!this.hass || !this._config) return html``;

    const schema = [
      { name: "name", selector: { text: {} } },
      { name: "script_entity", selector: { entity: { domain: ["script"] } } },
      { name: "download_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "down_icon", selector: { icon: {} } },
      { name: "upload_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "up_icon", selector: { icon: {} } },
      { name: "ping_entity", selector: { entity: { domain: ["sensor"] } } },
      { name: "ping_icon", selector: { icon: {} } }
    ];

    return html`
      <div class="editor-container">
        <ha-form
          .hass=${this.hass}
          .data=${this._config}
          .schema=${schema}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._valueChanged}
        ></ha-form>
        
        <div class="color-picker-row">
          <label>Background Color (Theme Default)</label>
          <div class="color-picker-controls">
            <input type="color" .value="${this._config.background_color || '#ffffff'}" @input="${this._colorChanged}">
            <button class="icon-btn" @click="${this._clearColor}" title="Reset to Theme">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _computeLabel(schema) {
    const labels = {
      name: "Card Name",
      script_entity: "Script Entity",
      download_entity: "Download Entity",
      down_icon: "Download Icon",
      upload_entity: "Upload Entity",
      up_icon: "Upload Icon",
      ping_entity: "Ping Entity",
      ping_icon: "Ping Icon"
    };
    return labels[schema.name];
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const newConfig = ev.detail.value;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _colorChanged(ev) {
    const newConfig = { ...this._config, background_color: ev.target.value };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _clearColor() {
    if (!this._config) return;
    const newConfig = { ...this._config };
    delete newConfig.background_color;
    
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
    this.requestUpdate();
  }

  static get styles() {
    return css`
      .editor-container { padding: 4px; }
      .color-picker-row { display: flex; flex-direction: column; gap: 8px; margin-top: 24px; padding-left: 4px; }
      .color-picker-row label { font-family: var(--paper-font-body1_-_font-family); font-size: 16px; color: var(--primary-text-color); }
      .color-picker-controls { display: flex; align-items: center; gap: 12px; }
      input[type="color"] { width: 45px; height: 35px; border: 1px solid var(--divider-color); border-radius: 4px; cursor: pointer; background: none; padding: 2px; }
      
      .icon-btn {
        background: var(--secondary-background-color, #e0e0e0);
        color: var(--primary-text-color);
        border: none;
        border-radius: 8px;
        width: 35px;
        height: 35px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .icon-btn:hover { background: var(--divider-color, #ccc); }
      .icon-btn ha-icon { --mdc-icon-size: 20px; }
    `;
  }
}

if (!customElements.get("omnilistic-speedtest-editor")) {
  customElements.define("omnilistic-speedtest-editor", OmnilisticEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === "omnilistic-speedtest")) {
  window.customCards.push({
    type: "omnilistic-speedtest",
    name: "Omnilistic Speedtest",
    description: "Responsive Speedtest UI Editor Component."
  });
}
