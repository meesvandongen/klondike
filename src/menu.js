const { Menu, shell } = require('electron');

function buildMenu(win) {
  const isMac = process.platform === 'darwin';
  const send = (channel, ...args) => win && win.webContents.send(channel, ...args);

  const template = [
    ...(isMac
      ? [
          {
            label: 'Klondike',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: '&Game',
      submenu: [
        {
          label: 'New Game',
          accelerator: 'F2',
          click: () => send('menu:new-game')
        },
        { type: 'separator' },
        {
          label: 'Statistics...',
          click: () => send('menu:stats')
        },
        {
          label: 'Options...',
          click: () => send('menu:options')
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit', label: 'Exit' }])
      ]
    },
    {
      label: '&Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => send('menu:undo')
        },
        { type: 'separator' },
        {
          label: 'Hint',
          accelerator: 'H',
          click: () => send('menu:hint')
        },
        {
          label: 'Auto-Complete',
          accelerator: 'CmdOrCtrl+A',
          click: () => send('menu:auto-complete')
        }
      ]
    },
    {
      label: '&View',
      submenu: [
        {
          label: 'Draw One',
          type: 'radio',
          checked: true,
          click: () => send('menu:toggle-draw', 1)
        },
        {
          label: 'Draw Three',
          type: 'radio',
          click: () => send('menu:toggle-draw', 3)
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: 'How to Play',
          click: () =>
            shell.openExternal('https://en.wikipedia.org/wiki/Klondike_(solitaire)')
        },
        { type: 'separator' },
        {
          label: 'About Klondike',
          click: () => send('menu:about-from-renderer')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };
