/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;

// Flow's local selection and metadata adapter (not an external plugin).
var flowBridgeScript = document.createElement('script');
flowBridgeScript.type = 'module';
flowBridgeScript.src = '../flow-bridge.js';
document.head.appendChild(flowBridgeScript);
