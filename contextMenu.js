let el = null;
let open = false;

function initContextMenu() {
  el = document.getElementById('context-menu');
  if (!el) {
    el = document.createElement('div');
    el.id = 'context-menu';
    el.className = 'context-menu';
    document.body.appendChild(el);
  }
  document.addEventListener('click', e => {
    if (open && !e.target.closest('.context-menu')) closeContextMenu();
  });
}

function contextMenu(event) {
  const items = [];
  const builder = {
    item(label, fn, icon, danger) {
      items.push({ label, fn, icon: icon || 'chevron-right', danger: !!danger });
      return builder;
    },
    sep() {
      items.push('sep');
      return builder;
    },
    danger(label, fn, icon) {
      items.push({ label, fn, icon: icon || 'trash-2', danger: true });
      return builder;
    },
    show() {
      if (!el) initContextMenu();
      el.innerHTML = '';
      items.forEach(item => {
        if (item === 'sep') {
          el.appendChild(Object.assign(document.createElement('div'), { className: 'context-menu-separator' }));
          return;
        }
        const div = document.createElement('div');
        div.className = 'context-menu-item' + (item.danger ? ' danger' : '');
        div.innerHTML = `<i data-lucide="${item.icon}"></i><span>${item.label}</span>`;
        div.onclick = e => { e.stopPropagation(); closeContextMenu(); item.fn(); };
        el.appendChild(div);
      });
      const mobile = matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
      let x = event.clientX, y = event.clientY;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.display = 'block';
      if (!mobile) {
        const rect = el.getBoundingClientRect();
        if (x + rect.width > innerWidth) el.style.left = (innerWidth - rect.width - 6) + 'px';
        if (y + rect.height > innerHeight) el.style.top = (innerHeight - rect.height - 6) + 'px';
      }
      lucide?.createIcons({ root: el });
      open = true;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  return builder;
}

function closeContextMenu() {
  if (el) el.style.display = 'none';
  open = false;
}

window.contextMenu = contextMenu;
window.closeContextMenu = closeContextMenu;
window.initContextMenu = initContextMenu;
