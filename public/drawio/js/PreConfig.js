/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// Overrides of global vars need to be pre-loaded
window.DRAWIO_PUBLIC_BUILD = true;
window.EXPORT_URL = null; // Replace with the URL of your export server to enable server-side PDF and image export, e.g. https://www.example.com/export. With null, export to PDF uses the print dialog
window.DRAWIO_BASE_URL = null; // Replace with path to base of deployment, e.g. https://www.example.com/folder
window.DRAWIO_VIEWER_URL = null; // Replace your path to the viewer js, e.g. https://www.example.com/js/viewer.min.js
window.DRAWIO_LIGHTBOX_URL = null; // Replace with your lightbox URL, eg. https://www.example.com
window.DRAW_MATH_URL = 'math4/es5';
window.DRAWIO_CONFIG = {darkColor:'#252a31',defaultDarkPageBackgroundColor:'#252a31'}; // Replace with your custom draw.io configurations. For more details, https://www.drawio.com/doc/faq/configure-diagram-editor
urlParams['sync'] = 'manual';

// Private deployment: do not enable remote storage or services.
window.DRAWIO_LOG_URL = '';
urlParams['offline'] = '1';
urlParams['stealth'] = '1';
urlParams['gapi'] = '0';
urlParams['gh'] = '0';
urlParams['od'] = '0';
urlParams['db'] = '0';
urlParams['tr'] = '0';
urlParams['plugins'] = '0';
