// public/components.js
function renderBottomNav(activePage) {
    const existing = document.querySelector('.bottom-nav');
    if (existing) existing.remove();

    const navHTML = `
    <style>
        .bottom-nav {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 28px;
            padding: 10px 20px;
            display: flex;
            gap: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1), 0 0 0 1px var(--border-active);
            z-index: 1000;
            font-family: var(--font-mono);
            animation: menuUp 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
        }
        @keyframes menuUp {
            from { opacity: 0; transform: translate(-50%, 30px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            text-decoration: none;
            color: var(--text-dim);
            font-size: 0.65em;
            font-weight: 800;
            padding: 8px 14px;
            border-radius: 18px;
            transition: all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
            position: relative;
        }
        .nav-item:hover, .nav-item.active { 
            color: var(--accent); 
            transform: translateY(-4px);
        }
        .nav-item.active::after {
            content: '';
            position: absolute;
            bottom: 2px;
            width: 12px;
            height: 3px;
            background: var(--accent);
            border-radius: 10px;
        }
        .nav-item.center-btn {
            background: var(--gradient);
            color: #fff;
            padding: 16px 20px;
            border-radius: 20px;
            transform: translateY(-18px);
            box-shadow: 0 8px 25px var(--accent-glow-strong);
            border: 3px solid var(--bg);
        }
        .nav-item.center-btn:hover { transform: translateY(-22px) scale(1.05); color: #fff; }
        .nav-item.center-btn::after { display: none; }
        .nav-item svg { width: 22px; height: 22px; transition: 0.3s; }
    </style>
    <div class="bottom-nav">
        <a href="/" class="nav-item ${activePage === 'home' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
        </a>
        <a href="/boost" class="nav-item ${activePage === 'boost' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>
            <span>Boost</span>
        </a>
        <a href="/freebot" class="nav-item center-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>Deploy</span>
        </a>
        <a href="/login" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Dashboard</span>
        </a>
        <a href="/login" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Account</span>
        </a>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);
}
