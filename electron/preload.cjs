const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('toolkitDesktop', Object.freeze({}));
