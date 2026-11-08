// ==UserScript==
// @name         retro-web (dev)
// @namespace    https://github.com/galmukhaizim/2000sInternet
// @version      0.4.0
// @description  Dev stub: loads the locally built retro-web bundle from disk
// @author       galmukhaizim
// @match        *://*/*
// @exclude      https://galmukhaizim.github.io/2000sInternet/*
// @exclude      http://localhost:4173/*
// @exclude      http://127.0.0.1:4173/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      api.anthropic.com
// @connect      huggingface.co
// @connect      cdn-lfs.huggingface.co
// @connect      cdn-lfs-us-1.huggingface.co
// @connect      raw.githubusercontent.com
// @connect      localhost
// @connect      127.0.0.1
// @require      file:///ABSOLUTE/PATH/TO/REPO/userscript/dist/retro.user.js
// ==/UserScript==

// Nothing here on purpose: the @require line above loads the real bundle.
// `npm run build` also writes dist/retro.dev.user.js with the correct absolute
// path for this checkout, so you can install that file instead of editing this one.
