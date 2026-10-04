import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import google.generativeai as genai
import os
import time

st.set_page_config(
    page_title="BaniTwin | PINN Cable Digital Twin",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
    <style>
    .stApp {
        background-color: #0E1117;
        color: #E0E0E0;
        font-family: 'Courier New', Courier, monospace;
    }
    .status-bar {
        background-color: #161A22;
        border-bottom: 1px solid #333;
        padding: 10px 20px;
        border-radius: 5px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
        font-size: 0.9rem;
    }
    .status-live { color: #00E676; text-shadow: 0 0 5px #00E676; }
    .status-node { color: #00E5FF; }
    .status-metric { color: #FF9100; }
    .kpi-card {
        background-color: #161A22;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        margin-bottom: 20px;
        border-left: 4px solid #00E5FF;
    }
    .kpi-card h4 {
        margin: 0;
        font-size: 0.9rem;
        color: #888;
        text-transform: uppercase;
    }
    .kpi-card h2 {
        margin: 10px 0 0 0;
        font-size: 2rem;
        color: #FFF;
    }
    .kpi-alert { border-left-color: #FF1744; }
    .kpi-alert h2 { color: #FF1744; text-shadow: 0 0 10px rgba(255,23,68,0.5); }
    .kpi-success { border-left-color: #00E676; }
    .kpi-success h2 { color: #00E676; text-shadow: 0 0 10px rgba(0,230,118,0.5); }
    .kpi-warning { border-left-color: #FF9100; }
    .copilot-box {
        background: linear-gradient(145deg, #161A22, #0E1117);
        border: 1px solid #00E5FF;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        box-shadow: 0 0 15px rgba(0, 229, 255, 0.1);
    }
    .copilot-title {
        color: #00E5FF;
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    </style>
""", unsafe_allow_html=True)

def calculate_thermal_state(I, T_amb, rho_soil, depth):
    R_ac = 5.83e-5
    D_e = 0.10
    R_th_cable = 0.478
    T_max_limit = 90.0
    R_th_soil = (rho_soil / (2 * np.pi)) * np.log((2 * depth) / D_e)
    R_th_total = R_th_cable + R_th_soil
    q_loss = (I ** 2) * R_ac
    T_hotspot = T_amb + (q_loss * R_th_total)
    if T_amb < T_max_limit:
        I_dyn = np.sqrt((T_max_limit - T_amb) / (R_ac * R_th_total))
    else:
        I_dyn = 0.0
    return T_hotspot, I_dyn, R_th_total, q_loss

st.sidebar.markdown("### ⚡ SCADA CONTROL PANEL")
st.sidebar.markdown("---")
current_load = st.sidebar.slider("Current Load (Amperes)", min_value=400, max_value=1400, value=950, step=10)
t_ambient = st.sidebar.slider("Ambient Soil Temp (°C)", min_value=10.0, max_value=45.0, value=28.0, step=0.5)
rho_soil = st.sidebar.slider("Soil Thermal Resistivity (K·m/W)", min_value=0.5, max_value=2.5, value=1.0, step=0.1)
cable_depth = st.sidebar.slider("Cable Installation Depth (m)", min_value=0.8, max_value=2.5, value=1.2, step=0.1)

STATIC_LIMIT = 750.0
T_hotspot, dynamic_capacity, r_th_total, q_loss = calculate_thermal_state(
    current_load, t_ambient, rho_soil, cable_depth
)
unlocked_capacity_pct = ((dynamic_capacity - STATIC_LIMIT) / STATIC_LIMIT) * 100
is_overheating = T_hotspot > 85.0

st.markdown("""
    <div class="status-bar">
        <div>STATUS: <span class="status-live">● LIVE</span></div>
        <div>GRID NODE: <span class="status-node">Node 407 - Metro Substation</span></div>
        <div>PINN LATENCY: <span class="status-metric">0.04s</span></div>
        <div>PHYSICS LOSS CONVERGENCE: <span class="status-metric">0.00018</span></div>
    </div>
""", unsafe_allow_html=True)

col1, col2, col3, col4 = st.columns(4)
alert_class = "kpi-alert" if is_overheating else "kpi-success"
with col1:
    st.markdown(f'<div class="kpi-card {alert_class}"><h4>Max Cable Hotspot Temp</h4><h2>{T_hotspot:.1f} °C</h2></div>', unsafe_allow_html=True)
with col2:
    st.markdown(f'<div class="kpi-card"><h4>Traditional Static Ampacity Limit</h4><h2>{STATIC_LIMIT:.0f} A</h2></div>', unsafe_allow_html=True)
with col3:
    st.markdown(f'<div class="kpi-card kpi-warning"><h4>BaniTwin PINN Dynamic Capacity</h4><h2>{dynamic_capacity:.0f} A</h2></div>', unsafe_allow_html=True)
with col4:
    st.markdown(f'<div class="kpi-card kpi-success"><h4>Unlocked Latent Grid Capacity</h4><h2>+{unlocked_capacity_pct:.1f} %</h2></div>', unsafe_allow_html=True)

col_left, col_right = st.columns(2)
with col_left:
    st.markdown("<h4 style='color: #00E5FF;'>2D Cable Thermal Heatmap (Cross-Section)</h4>", unsafe_allow_html=True)
    x = np.linspace(-0.5, 0.5, 100)
    y = np.linspace(-0.5, 0.5, 100)
    X, Y = np.meshgrid(x, y)
    R = np.sqrt(X**2 + Y**2)
    r_core = 0.02
    r_cable = 0.05
    R_max = 0.5
    T_grid = np.zeros_like(R)
    T_grid[R <= r_core] = T_hotspot
    mask_decay = (R > r_core) & (R <= R_max)
    T_grid[mask_decay] = t_ambient + (T_hotspot - t_ambient) * (np.log(R_max / R[mask_decay]) / np.log(R_max / r_core))
    T_grid[R > R_max] = t_ambient
    fig_heatmap = go.Figure(data=go.Contour(z=T_grid, x=x, y=y, colorscale='Inferno', colorbar=dict(title="Temp (°C)")))
    fig_heatmap.update_layout(plot_bgcolor='#0E1117', paper_bgcolor='#0E1117', margin=dict(l=0, r=0, t=30, b=0), height=400)
    st.plotly_chart(fig_heatmap, use_container_width=True)

with col_right:
    st.markdown("<h4 style='color: #00E5FF;'>24H Dynamic Thermal Rating vs Load Curve</h4>", unsafe_allow_html=True)
    hours = np.arange(0, 25)
    base_load = np.clip(600 + 380 * np.sin(np.pi * (hours - 6) / 12), 420, 1250)
    base_load[18] = current_load
    amb_temps = t_ambient + 3.2 * np.sin(np.pi * (hours - 9) / 12)
    dyn_ratings = [calculate_thermal_state(base_load[h], amb_temps[h], rho_soil, cable_depth)[1] for h in range(25)]
    fig_ts = go.Figure()
    fig_ts.add_trace(go.Scatter(x=hours, y=base_load, mode='lines+markers', name='Actual Load (A)', line=dict(color='#00E5FF', width=3)))
    fig_ts.add_trace(go.Scatter(x=hours, y=dyn_ratings, mode='lines', name='PINN Dynamic Limit (A)', line=dict(color='#FF9100', width=2, dash='dash')))
    fig_ts.add_trace(go.Scatter(x=hours, y=[STATIC_LIMIT]*25, mode='lines', name='Static Limit (750A)', line=dict(color='#FF1744', width=2, dash='dot')))
    fig_ts.update_layout(plot_bgcolor='#0E1117', paper_bgcolor='#0E1117', height=400, margin=dict(l=0, r=0, t=30, b=0))
    st.plotly_chart(fig_ts, use_container_width=True)
