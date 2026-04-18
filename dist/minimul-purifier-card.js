// ============================================================
//  Minimal Purifier Card
// ============================================================

const TRANSLATIONS = {
  en: { 
    air_quality:'Air Quality', 
    good:'Good', 
    fair:'Fair', 
    moderate:'Moderate', 
    unhealthy:'Unhealthy', 
    severe:'Severe', 
    hazardous:'Hazardous',
    active:'Active', 
    inactive:'Inactive',
    temperature:'Temperature', 
    humidity:'Humidity',
    speed_adj:'Speed adjustment',
    filter:'Filter'
  }
};

function tr(key) {
  return TRANSLATIONS.en[key] || key;
}

function pmToQuality(pm) {
  const v = parseFloat(pm);
  if (isNaN(v) || v <= 20) return tr('good');
  if (v <= 35)  return tr('fair');
  if (v <= 55)  return tr('moderate');
  if (v <= 80)  return tr('unhealthy');
  if (v <= 120) return tr('severe');
  return tr('hazardous');
}

function pmToColor(pm, primary) {
  const v = parseFloat(pm);
  if (isNaN(v) || v <= 20) return primary; 
  if (v <= 35)  return '#ffb300'; 
  if (v <= 55)  return '#ff7043'; 
  if (v <= 80)  return '#e53935'; 
  if (v <= 120) return '#c62828'; 
  return '#8e0000';             
}

function toHex(color) {
  if (!color) return '#000000';
  if (typeof color === 'string') {
    const c = color.trim();
    if (c.startsWith('#')) return c.length === 7 ? c : '#000000';
    const parts = c.split(',').map(Number);
    if (parts.length === 3) return '#' + parts.map(v => Math.min(255,Math.max(0,v)).toString(16).padStart(2,'0')).join('');
    return '#000000';
  }
  if (Array.isArray(color) && color.length === 3) {
    return '#' + color.map(v => Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,'0')).join('');
  }
  return '#000000';
}

function hexToRgb(hex) {
  const h = toHex(hex).replace('#','');
  return { r:parseInt(h.slice(0,2),16)||0, g:parseInt(h.slice(2,4),16)||0, b:parseInt(h.slice(4,6),16)||0 };
}

function alpha(hex,a) {
  try { const {r,g,b}=hexToRgb(toHex(hex)); return `rgba(${r},${g},${b},${a})`; } catch{return hex;}
}

// ════════════════════════════════════════════════════════════
//  EDITOR
// ════════════════════════════════════════════════════════════
class MinimalPurifierCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config = {};
    this._hass   = null;
    this._built  = false;
  }

  setConfig(config) {
    this._config = {...config};
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._build();
  }

  _schema() {
    return [
      { name:'name', selector:{ text:{} } },
      { name:'icon', selector:{ icon:{} } },
      { name:'power_entity', selector:{ entity:{} } },
      { name:'pm_entity',    selector:{ entity:{ domain:'sensor', unit_of_measurement:'µg/m³' } } },
      { name:'temperature_entity', selector:{ entity:{ domain:'sensor', unit_of_measurement:['°C','°F'] } } },
      { name:'humidity_entity',    selector:{ entity:{ domain:'sensor', unit_of_measurement:'%' } } },
      { name:'mode_entity',        selector:{ entity:{} } },
      { name:'speed_entity',       selector:{ entity:{ domain:'number' } } },
      { name:'buzzer_entity',      selector:{ entity:{} } },
      { name:'child_lock_entity',  selector:{ entity:{} } },
      { name:'filter_life_entity', selector:{ entity:{ domain:'sensor' } } },
      { name:'filter_days_entity', selector:{ entity:{ domain:'sensor' } } },
      {
        type:'grid', name:'', flatten:true,
        schema:[
          { name:'show_particles',       selector:{ boolean:{} } },
          { name:'show_background_glow', selector:{ boolean:{} } },
          { name:'show_ring',            selector:{ boolean:{} } },
          { name:'show_ring_glow',       selector:{ boolean:{} } },
          { name:'animate_rings',        selector:{ boolean:{} } },
        ]
      },
      { name:'ring_speed',           selector:{ number:{ min:0, max:100, step:1 } } },
      { name:'particle_speed',       selector:{ number:{ min:0, max:100, step:1 } } },
      { name:'card_opacity', selector:{ number:{ min:0, max:100, step:1 } } },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      name:'Card name', icon:'Card icon', power_entity:'Power switch (fan / switch)',
      pm_entity:'PM2.5 Sensor', temperature_entity:'Temperature Sensor', humidity_entity:'Humidity Sensor',
      mode_entity:'Mode Preset (Input Select/Fan)', speed_entity:'Favorite Speed (Number 0-14)', 
      buzzer_entity:'Buzzer Switch', child_lock_entity:'Child Lock Switch',
      filter_life_entity:'Filter Life Remaining (%) Sensor', filter_days_entity:'Filter Lifetime Remaining (Days) Sensor',
      show_particles:'Show particle animation',
      show_background_glow:'Show background glow', show_ring:'Show ring',
      show_ring_glow:'Show glow around ring', animate_rings:'Animate ring',
      ring_speed:'Ring speed (0-100)',
      particle_speed:'Particle speed (0-100)',
      card_opacity:'Card transparency (0=transparent, 100=solid)'
    };
    return labels[schema.name] || schema.name;
  }

  _build() {
    if (!this._hass) return;
    if (!this._built) {
      this._built = true;
      this.shadowRoot.innerHTML = `
        <style>ha-form { display:block; padding: 4px 0; }</style>
        <ha-form></ha-form>
      `;
      const form = this.shadowRoot.querySelector('ha-form');
      form.addEventListener('value-changed', (e) => {
        e.stopPropagation();
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent('config-changed', {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        }));
      });
    }

    const form = this.shadowRoot.querySelector('ha-form');
    if (!form) return;
    form.hass         = this._hass;
    form.schema       = this._schema();
    form.data         = this._config;
    form.computeLabel = (s) => this._computeLabel(s);
  }
}

customElements.define('minimal-purifier-card-editor', MinimalPurifierCardEditor);

// ════════════════════════════════════════════════════════════
//  MAIN CARD
// ════════════════════════════════════════════════════════════
class MinimalPurifierCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this._config    = {};
    this._hass      = null;
    this._raf       = null;
    this._particles = [];
    this._canvas    = null;
    this._ctx       = null;
    this._builtDOM  = false;
    this._lastSpeed = -1;
    this._lastPMult = -1;
    this._lastP     = null;
    this._lastS     = null;
  }

  static getConfigElement() {
    return document.createElement('minimal-purifier-card-editor');
  }

  static getStubConfig(hass) {
    const s = hass ? hass.states : {};
    return {
      name: 'Minimal Purifier',
      icon: 'mdi:air-purifier',
      power_entity: Object.keys(s).find(e=>e.startsWith('fan.')||e.startsWith('switch.')&&e.includes('purif'))||'',
      animate_rings: true,
      show_particles: true,
      ring_speed: 50,
      particle_speed: 50
    };
  }

  setConfig(config) {
    const newConfig = {
      name:'Minimal Purifier',
      icon:'mdi:air-purifier',
      color_primary:'#00c896', color_secondary:'#00bcd4',
      show_particles:true, show_background_glow:true, show_ring:true, show_ring_glow:true, animate_rings:true,
      ...config,
    };

    const structuralKeys = ['show_particles','show_background_glow','show_ring','show_ring_glow','animate_rings','icon'];
    const needsRebuild = !this._config || structuralKeys.some(k => 
      JSON.stringify(this._config[k]) !== JSON.stringify(newConfig[k])
    );

    this._config = newConfig;
    if (needsRebuild) this._builtDOM = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _togglePower() {
    const eid = this._config.power_entity;
    if (!eid || !this._hass) return;
    const domain = eid.split('.')[0];
    const svc = ['fan','switch','input_boolean','light'].includes(domain) ? domain : 'homeassistant';
    this._hass.callService(svc, 'toggle', { entity_id: eid });
  }

  _toggleEntity(eid) {
    if (!eid || !this._hass) return;
    const domain = eid.split('.')[0];
    const svc = ['fan','switch','input_boolean','light','lock'].includes(domain) ? domain : 'homeassistant';
    this._hass.callService(svc, 'toggle', { entity_id: eid });
  }

  _cycleMode() {
    const eid = this._config.mode_entity;
    if (!eid || !this._hass) return;
    const state = this._hass.states[eid]?.state?.toLowerCase() || '';
    let nextMode = 'Auto';
    if (state.includes('auto')) nextMode = 'Silent';
    else if (state.includes('silent')) nextMode = 'Favorite';
    else if (state.includes('favorite')) nextMode = 'Auto';
    
    const domain = eid.split('.')[0];
    if (domain === 'input_select' || domain === 'select') {
      this._hass.callService(domain, 'select_option', { entity_id: eid, option: nextMode });
    } else if (domain === 'fan') {
      this._hass.callService('fan', 'set_preset_mode', { entity_id: eid, preset_mode: nextMode });
    }
  }

  _setSpeed(percentage) {
    const eid = this._config.speed_entity;
    if (!eid || !this._hass) return;
    const targetVal = Math.round((percentage / 100) * 14);
    this._hass.callService('number', 'set_value', { entity_id: eid, value: targetVal });
  }

  _isOn() {
    const eid = this._config.power_entity;
    if (!eid || !this._hass) return false;
    const state = this._hass.states[eid]?.state || '';
    return !['off','idle','unavailable','unknown',''].includes(state.toLowerCase());
  }

  _stopParticles() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf=null; }
  }

  _startParticles(canvas, speed, p, s, speedMult=1) {
    this._stopParticles();
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');
    const W=canvas.width, H=canvas.height, cx=W/2, cy=H/2;
    const outerR=W*0.46, innerR=W*0.235;
    const count=[0,18,30,45,62,80][Math.min(speed,5)];
    this._particles = Array.from({length:count},()=>this._newParticle(cx,cy,outerR,true));
    const pRgb=hexToRgb(p), sRgb=hexToRgb(s);
    const loop=()=>{
      this._ctx.clearRect(0,0,W,H);
      const cfg=this._config||{};
      const livePSpd=cfg.particle_speed??50;
      const liveMult=Math.max(0.05,(livePSpd/100)*3.0);
      this._particles.forEach(pt=>{
        pt.dist -= pt.spd*(0.4+speed*0.3)*liveMult;
        pt.x=cx+Math.cos(pt.angle)*pt.dist;
        pt.y=cy+Math.sin(pt.angle)*pt.dist;
        if (pt.dist<=innerR+3){ Object.assign(pt,this._newParticle(cx,cy,outerR,false)); return; }
        const fade=Math.min(1,(pt.dist-innerR)/35);
        const blend=Math.min(1,(pt.dist-innerR)/(outerR-innerR));
        const r=Math.round(pRgb.r*(1-blend)+sRgb.r*blend);
        const g=Math.round(pRgb.g*(1-blend)+sRgb.g*blend);
        const b=Math.round(pRgb.b*(1-blend)+sRgb.b*blend);
        this._ctx.beginPath();
        this._ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);
        this._ctx.fillStyle=`rgba(${r},${g},${b},${pt.opacity*fade})`;
        this._ctx.fill();
      });
      this._raf=requestAnimationFrame(loop);
    };
    this._raf=requestAnimationFrame(loop);
  }

  _newParticle(cx,cy,outerR,randomStart){
    const angle=Math.random()*Math.PI*2;
    const dist=randomStart?(outerR*0.4)+Math.random()*outerR*0.6:outerR+Math.random()*10;
    return { x:cx+Math.cos(angle)*dist, y:cy+Math.sin(angle)*dist, angle, dist,
      size:1.2+Math.random()*2, opacity:0.2+Math.random()*0.6, spd:0.5+Math.random()*1.2 };
  }

  _render() {
    if (!this._config || !this._hass) return;
    try {
      const hass=this._hass, cfg=this._config;
      
      const pmRaw=hass?.states[cfg.pm_entity]?.state??null;
      const pmVal=pmRaw??'4';
      const temp=hass?.states[cfg.temperature_entity]?.state??null;
      const hum=hass?.states[cfg.humidity_entity]?.state??null;
      
      const modeState=hass?.states[cfg.mode_entity]?.state?.toLowerCase()||'auto';
      const buzzerState=hass?.states[cfg.buzzer_entity]?.state?.toLowerCase()==='on';
      const lockState=hass?.states[cfg.child_lock_entity]?.state?.toLowerCase()==='on';
      
      const filterLifeRaw = hass?.states[cfg.filter_life_entity]?.state;
      const filterDaysRaw = hass?.states[cfg.filter_days_entity]?.state;
      const filterLife = parseFloat(filterLifeRaw);
      
      const isFavorite = modeState.includes('favorite');

      const speedRaw = parseFloat(hass?.states[cfg.speed_entity]?.state ?? 0);
      const speedPct = isNaN(speedRaw) ? 1 : Math.max(1, Math.round((speedRaw / 14) * 100));

      const fanPct=parseInt(hass?.states[cfg.power_entity]?.attributes?.percentage ?? 0);
      const isOn=this._isOn();
      const speed=isOn ? (fanPct > 0 ? Math.ceil(fanPct/20) : 2) : 0;
      
      const qualityLabel=pmToQuality(pmVal);
      const qualityColor=pmToColor(pmVal, '#00c896');
      const subtitle=isOn ? tr('active') : tr('inactive');
      
      const pmNum = parseFloat(pmVal);
      const p = qualityColor;
      const s = (isNaN(pmNum) || pmNum <= 20) ? '#00bcd4' : qualityColor;

      const fixedAccent = '#00c896'; 
      // FIXED: Power button now strictly uses fixedAccent
      const pwrBg=isOn?`linear-gradient(135deg,${fixedAccent},${alpha(fixedAccent,0.8)})`:`var(--secondary-background-color, rgba(150,150,150,0.2))`;
      const pwrShadow=isOn?`0 4px 16px ${alpha(fixedAccent,0.5)}`:'none';
      const pwrIconColor=isOn?'#fff':`var(--secondary-text-color, #8a9bb0)`;
      
      const showParticle=cfg.show_particles!==false;
      const customIcon=cfg.icon||'mdi:air-purifier';
      const cardOpacity=cfg.card_opacity!=null?Number(cfg.card_opacity):100;

      if (!this._builtDOM) {
        this._builtDOM=true;
        this._stopParticles();
        this.shadowRoot.innerHTML=`
          <style>
            :host{display:block;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;width:100%;box-sizing:border-box;}
            .minimal-wrapper { display:flex; flex-direction:column; gap:12px; }
            
            .card, .sub-card {
              background: var(--ha-card-background, var(--card-background-color, #ffffff));
              border-radius: var(--ha-card-border-radius, 28px);
              padding: 24px; width: 100%; box-sizing: border-box;
              box-shadow: var(--ha-card-box-shadow, 0 4px 12px rgba(0,0,0,.04));
              border: var(--ha-card-border-width, 0) solid var(--ha-card-border-color, transparent);
              position: relative; overflow: hidden; opacity: ${cardOpacity/100};
            }
            .sub-card { border-radius: 24px; padding: 16px 24px; overflow: visible; transition: opacity 0.3s ease; }

            .glow-a{position:absolute;top:40px;right:-50px;width:280px;height:200px;
              background:radial-gradient(ellipse,${alpha(p,0.13)} 0%,transparent 70%);border-radius:50%;pointer-events:none;}
            .glow-b{position:absolute;top:90px;left:-50px;width:220px;height:180px;
              background:radial-gradient(ellipse,${alpha(s,0.10)} 0%,transparent 70%);border-radius:50%;pointer-events:none;}
            .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;position:relative;z-index:1;}
            .header-left{display:flex;align-items:center;gap:12px;}
            .header-icon{width:42px;height:42px;border-radius:13px;background:${alpha(s,0.15)};display:flex;align-items:center;justify-content:center;}
            .header-icon ha-icon{--mdc-icon-size:22px;color:${s};}
            .header-title{font-size:clamp(14px,5vw,20px);font-weight:700;color:var(--primary-text-color, #1a2332);letter-spacing:-.3px;line-height:1.2;}
            .header-sub{font-size:12px;color:var(--secondary-text-color, #8a9bb0);margin-top:2px;}
            .power-btn{width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;
              display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s,box-shadow .2s,background .3s;}
            .power-btn:hover{transform:scale(1.08);}
            .power-btn ha-icon{--mdc-icon-size:20px;transition:color .3s;}
            .circle-wrap{display:flex;justify-content:center;margin-bottom:10px;position:relative;z-index:1;overflow:visible;}
            canvas.particles{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;pointer-events:none;z-index:0;}
            
            .circle-ring {
              position: relative;
              width: 100%;
              max-width: 220px;
              aspect-ratio: 1 / 1;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .circle-ring-svg{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:${cfg.show_ring===false?'none':'block'};}
            .ring-inner-circle.animating{animation:ringPulse ${(()=>{
              const spd=cfg.ring_speed??50;
              if(spd===0) return '9999';
              return Math.max(0.2, 8-(spd/100)*7.8).toFixed(1);
            })()}s ease-in-out infinite;}
            .ring-inner-circle.paused{animation:none;}
            @keyframes ringPulse{0%,100%{opacity:0.5;}50%{opacity:1;}}
            .circle-inner {
              position: absolute;
              top: 50%; left: 50%; transform: translate(-50%, -50%);
              z-index: 2; text-align: center;
              width: 72%;
              display: flex; flex-direction: column; align-items: center;
            }
            .circle-label{font-size:12px;color:var(--secondary-text-color, #8a9bb0);font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;}
            .circle-value{font-size:28px;font-weight:800;letter-spacing:-.5px;line-height:1.1;}
            .circle-pm{font-size:11px;color:var(--secondary-text-color, #8a9bb0);margin-top:7px;display:flex;align-items:center;justify-content:center;gap:5px;}
            .pm-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
            
            .controls-deck { display:flex; justify-content:space-around; align-items:center; }
            .ctrl-btn {
              width:54px; height:54px; border-radius:50%; border:none; cursor:pointer;
              display:flex; align-items:center; justify-content:center;
              transition:transform .15s, background .2s, color .2s;
            }
            .ctrl-btn:hover { transform:scale(1.05); }
            .ctrl-btn ha-icon { --mdc-icon-size:24px; pointer-events:none; }

            .section-title {
              font-size: 15px; font-weight: 700; color: var(--primary-text-color, #1a2332); letter-spacing: -0.2px;
            }

            .speed-card {
              display: none; flex-direction: column; gap: 16px; transition: all 0.3s ease;
            }
            .speed-header { display: flex; justify-content: center; align-items: center; }
            .speed-val { font-size: 15px; font-weight: 700; color: var(--p-color, ${p}); }
            
            .slider-track {
              position: relative; height: 40px; border-radius: 20px; margin: 0 10px;
              background: var(--secondary-background-color, rgba(0,0,0,0.08)); 
              cursor: pointer; touch-action: none; user-select: none;
            }
            .slider-fill {
              position: absolute; left: 0; top: 0; bottom: 0; min-width: 40px; border-radius: 20px;
              background: var(--p-color, ${p});
              pointer-events: none;
            }
            .slider-thumb {
              position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%;
              background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); pointer-events: none;
            }

            .filter-card { display: none; align-items: center; gap: 16px; }
            .filter-icon-wrap {
              width: 48px; height: 48px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
            }
            .filter-icon-wrap ha-icon { --mdc-icon-size: 24px; }
            .filter-info { display: flex; flex-direction: column; gap: 4px; flex: 1; justify-content: center; }
            .filter-stats { display: flex; flex-direction: column; gap: 2px; }
            .filter-stat { font-size: 13px; color: var(--secondary-text-color, #8a9bb0); font-weight: 500; }
            .filter-stat span { font-weight: 700; color: var(--primary-text-color, #1a2332); }
          </style>
          
          <div class="minimal-wrapper">
            <div class="card">
              <div class="glow-a" id="glow-a"></div><div class="glow-b" id="glow-b"></div>
              <div class="header">
                <div class="header-left">
                  <div class="header-icon"><ha-icon icon="${customIcon}"></ha-icon></div>
                  <div style="display:flex;flex-direction:column;justify-content:center;">
                    <div class="header-title" id="card-name"></div>
                    <div class="header-sub" id="card-sub"></div>
                  </div>
                </div>
                <button class="power-btn" id="power-btn">
                  <ha-icon icon="mdi:power"></ha-icon>
                </button>
              </div>
              <div class="circle-wrap">
                <div class="circle-ring" id="circle-container">
                  ${showParticle?'<canvas class="particles" width="360" height="360"></canvas>':''}
                  <svg class="circle-ring-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop id="grad-stop-1" offset="0%" stop-color="${s}"/>
                        <stop id="grad-stop-2" offset="100%" stop-color="${p}"/>
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="b"/>
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="var(--divider-color, rgba(150,150,150,0.15))" stroke-width="4"/>
                    <circle class="ring-inner-circle ${cfg.animate_rings!==false?'animating':'paused'}"
                      cx="50" cy="50" r="46" fill="none"
                      stroke="url(#rg)" stroke-width="4"
                      ${cfg.show_ring_glow!==false?'filter="url(#glow)"':''} opacity="0.9"/>
                  </svg>
                  <div class="circle-inner" id="circle-inner-content"></div>
                </div>
              </div>
            </div>
            
            <div class="sub-card controls-deck" id="controls-card">
              <button class="ctrl-btn" id="btn-mode"><ha-icon id="icon-mode" icon="mdi:refresh-auto"></ha-icon></button>
              <button class="ctrl-btn" id="btn-buzzer"><ha-icon id="icon-buzzer" icon="mdi:volume-off"></ha-icon></button>
              <button class="ctrl-btn" id="btn-lock"><ha-icon id="icon-lock" icon="mdi:lock-open"></ha-icon></button>
            </div>

            <div class="sub-card speed-card" id="speed-card">
              <div class="speed-header section-title">
                <span>${tr('speed_adj')}</span><span style="margin:0 6px; color:var(--secondary-text-color, #8a9bb0); font-weight:400;">|</span><span class="speed-val" id="speed-val">1%</span>
              </div>
              <div class="slider-track" id="speed-track">
                <div class="slider-fill" id="speed-fill" style="width:1%">
                  <div class="slider-thumb" id="speed-thumb"></div>
                </div>
              </div>
            </div>

            <div class="sub-card filter-card" id="filter-card">
              <div class="filter-icon-wrap" id="filter-icon-wrap">
                <ha-icon icon="mdi:air-filter" id="filter-icon"></ha-icon>
              </div>
              <div class="filter-info">
                <div class="section-title">${tr('filter')}</div>
                <div class="filter-stats">
                  <div class="filter-stat"><span id="filter-life-val">--</span>% remaining, <span id="filter-days-val">--</span> days remaining</div>
                </div>
              </div>
            </div>
          </div>`;

        this.shadowRoot.getElementById('power-btn')?.addEventListener('click',()=>this._togglePower());
        this.shadowRoot.getElementById('btn-mode')?.addEventListener('click',()=>this._cycleMode());
        this.shadowRoot.getElementById('btn-buzzer')?.addEventListener('click',()=>this._toggleEntity(this._config.buzzer_entity));
        this.shadowRoot.getElementById('btn-lock')?.addEventListener('click',()=>this._toggleEntity(this._config.child_lock_entity));
      }

      const root=this.shadowRoot;
      
      const stop1 = root.getElementById('grad-stop-1');
      const stop2 = root.getElementById('grad-stop-2');
      if (stop1) stop1.setAttribute('stop-color', s);
      if (stop2) stop2.setAttribute('stop-color', p);
      
      const glowA=root.getElementById('glow-a');
      const glowB=root.getElementById('glow-b');
      if(glowA) { glowA.style.display=cfg.show_background_glow!==false?'block':'none'; glowA.style.background=`radial-gradient(ellipse,${alpha(p,0.13)} 0%,transparent 70%)`; }
      if(glowB) { glowB.style.display=cfg.show_background_glow!==false?'block':'none'; glowB.style.background=`radial-gradient(ellipse,${alpha(s,0.10)} 0%,transparent 70%)`; }

      const nameEl=root.getElementById('card-name'); if(nameEl) nameEl.textContent=cfg.name||'Minimal Purifier';
      const subEl=root.getElementById('card-sub');   if(subEl)  subEl.textContent=subtitle;
      
      const pwrBtn=root.getElementById('power-btn');
      if(pwrBtn){ pwrBtn.style.background=pwrBg; pwrBtn.style.boxShadow=pwrShadow; pwrBtn.querySelector('ha-icon').style.color=pwrIconColor; }
      
      const iconEl=root.querySelector('.header-icon ha-icon');
      if(iconEl && iconEl.getAttribute('icon') !== customIcon) iconEl.setAttribute('icon', customIcon);
      const headerIconBox=root.querySelector('.header-icon');
      if(headerIconBox) headerIconBox.style.background = alpha(s,0.15);
      if(iconEl) iconEl.style.color = s;

      const circleInner=root.getElementById('circle-inner-content');
      if(circleInner){
        let extraHtml = '';
        if(temp || hum) {
          extraHtml += `<div class="circle-pm" style="margin-top:2px;">`;
          if(temp) extraHtml += `<span>${tr('temperature')}: ${temp}°C</span>`;
          if(temp && hum) extraHtml += `<span style="margin:0 4px;">|</span>`;
          if(hum) extraHtml += `<span>${tr('humidity')}: ${hum}%</span>`;
          extraHtml += `</div>`;
        }

        circleInner.innerHTML=
          '<div class="circle-label">'+tr('air_quality')+'</div>'+
          '<div class="circle-value" style="color:'+qualityColor+'">'+qualityLabel+'</div>'+
          '<div class="circle-pm">'+
          '<span class="pm-dot" style="background:'+qualityColor+'"></span>'+
          '<span>'+(pmRaw?'PM2.5: '+pmRaw+' µg/m³':'PM2.5: – µg/m³')+'</span>'+
          '</div>' + extraHtml;
      }

      const ringEl=root.querySelector('.ring-inner-circle');
      if(ringEl && cfg.animate_rings!==false){
        const rSpd=cfg.ring_speed??50;
        const rDur=rSpd===0?'9999s':Math.max(0.2,8-(rSpd/100)*7.8).toFixed(1)+'s';
        ringEl.style.animationDuration=rDur;
      }

      // Update Controls UI + Disable Logic if OFF
      const controlsCard = root.getElementById('controls-card');
      if (controlsCard) {
        controlsCard.style.opacity = isOn ? '1' : '0.4';
        controlsCard.style.pointerEvents = isOn ? 'auto' : 'none';
      }

      const btnMode = root.getElementById('btn-mode');
      const iconMode = root.getElementById('icon-mode');
      if (btnMode && iconMode) {
        if (modeState.includes('silent')) { iconMode.setAttribute('icon', 'mdi:weather-night'); }
        else if (modeState.includes('favorite')) { iconMode.setAttribute('icon', 'mdi:heart-outline'); }
        else { iconMode.setAttribute('icon', 'mdi:refresh-auto'); }
        btnMode.style.color = fixedAccent;
        btnMode.style.background = alpha(fixedAccent, 0.15);
      }

      const btnBuzzer = root.getElementById('btn-buzzer');
      const iconBuzzer = root.getElementById('icon-buzzer');
      if (btnBuzzer && iconBuzzer) {
        iconBuzzer.setAttribute('icon', buzzerState ? 'mdi:volume-high' : 'mdi:volume-off');
        btnBuzzer.style.color = buzzerState ? fixedAccent : `var(--secondary-text-color, #8a9bb0)`;
        btnBuzzer.style.background = buzzerState ? alpha(fixedAccent, 0.15) : `var(--secondary-background-color, rgba(0,0,0,0.05))`;
      }

      const btnLock = root.getElementById('btn-lock');
      const iconLock = root.getElementById('icon-lock');
      if (btnLock && iconLock) {
        iconLock.setAttribute('icon', lockState ? 'mdi:lock' : 'mdi:lock-open');
        btnLock.style.color = lockState ? '#e53935' : `var(--secondary-text-color, #8a9bb0)`;
        btnLock.style.background = lockState ? alpha('#e53935', 0.15) : `var(--secondary-background-color, rgba(0,0,0,0.05))`;
      }

      const speedCard = root.getElementById('speed-card');
      if (speedCard) {
        speedCard.style.display = isFavorite ? 'flex' : 'none';
        speedCard.style.setProperty('--p-color', fixedAccent);
        speedCard.style.opacity = isOn ? '1' : '0.4';
        speedCard.style.pointerEvents = isOn ? 'auto' : 'none';
      }

      const speedTrack = root.getElementById('speed-track');
      if (speedTrack && !speedTrack._initialized) {
        speedTrack._initialized = true;
        let dragging = false;

        speedTrack.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        speedTrack.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });

        const getPct = (clientX) => {
          const rect = speedTrack.getBoundingClientRect();
          return Math.round(Math.min(100, Math.max(1, ((clientX - rect.left) / rect.width) * 100)));
        };

        const updateVisual = (pct) => {
          const val14 = Math.round((pct / 100) * 14);
          const snappedPct = Math.max(1, Math.round((val14 / 14) * 100));
          
          speedTrack._currentPct = snappedPct;
          const fill  = root.getElementById('speed-fill');
          const val   = root.getElementById('speed-val');
          
          if (fill) fill.style.width = snappedPct + '%';
          if (val)  val.textContent  = snappedPct + '%';
        };

        speedTrack.addEventListener('pointerdown', (e) => {
          if (!isOn) return;
          dragging = true;
          speedTrack.setPointerCapture(e.pointerId);
          e.preventDefault(); e.stopPropagation();
          updateVisual(getPct(e.clientX));
        });

        speedTrack.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          e.preventDefault(); e.stopPropagation();
          updateVisual(getPct(e.clientX));
        });

        speedTrack.addEventListener('pointerup', (e) => {
          if (!dragging) return;
          dragging = false;
          updateVisual(getPct(e.clientX));
          
          speedTrack._ignoreHAUntil = Date.now() + 2500;
          this._setSpeed(speedTrack._currentPct); 
        });

        speedTrack.addEventListener('pointercancel', () => { dragging = false; });
      }

      const now = Date.now();
      if (speedTrack && !speedTrack.hasPointerCapture(speedTrack._pointerId) && (!speedTrack._ignoreHAUntil || now > speedTrack._ignoreHAUntil)) {
        const fill  = root.getElementById('speed-fill');
        const val   = root.getElementById('speed-val');
        if (fill) fill.style.width = speedPct + '%';
        if (val)  val.textContent  = speedPct + '%';
      }

      const filterCard = root.getElementById('filter-card');
      if (filterCard && (cfg.filter_life_entity || cfg.filter_days_entity)) {
        filterCard.style.display = 'flex';
        root.getElementById('filter-life-val').textContent = isNaN(filterLife) ? '--' : filterLife;
        root.getElementById('filter-days-val').textContent = filterDaysRaw || '--';

        let fColor = '#00c896'; 
        if (!isNaN(filterLife)) {
          if (filterLife <= 5) fColor = '#e53935'; 
          else if (filterLife <= 15) fColor = '#ff7043';
          else if (filterLife <= 30) fColor = '#ffb300';
        }
        
        const fIconWrap = root.getElementById('filter-icon-wrap');
        const fIcon = root.getElementById('filter-icon');
        if (fIconWrap) fIconWrap.style.background = alpha(fColor, 0.15);
        if (fIcon) fIcon.style.color = fColor;
      }

      if(showParticle){
        const canvas=root.querySelector('canvas.particles');
        if(canvas){
          const pSpd=cfg.particle_speed??50;
          const pMult=Math.max(0.05,(pSpd/100)*3.0);
          const needRestartP=speed!==this._lastSpeed||!this._raf||
            pMult!==this._lastPMult||p!==this._lastP||s!==this._lastS;
          if(needRestartP){
            this._lastSpeed=speed;
            this._lastPMult=pMult;
            this._lastP=p;
            this._lastS=s;
            if(speed===0){ this._stopParticles(); this._ctx?.clearRect(0,0,canvas.width,canvas.height); }
            else { this._startParticles(canvas,speed,p,s,pMult); }
          }
        }
      } else { this._stopParticles(); }
    } catch(e) {
      console.error('MinimalPurifierCard render error:', e);
    }
  }

  disconnectedCallback(){ this._stopParticles(); }
  getCardSize(){ return 8; }
}

customElements.define('minimal-purifier-card', MinimalPurifierCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'minimal-purifier-card',
  name:        'Minimal Purifier Card',
  description: 'Simplified air purifier card with controls deck, dynamic speed slider, PM2.5 monitoring, and filter stats.',
  preview:     true,
});
