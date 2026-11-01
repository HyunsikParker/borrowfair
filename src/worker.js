import { solve } from './engine.js';
self.onmessage = ({ data }) => { try { self.postMessage({ id: data.id, result: solve(data.board) }); } catch (e) { self.postMessage({ id: data.id, result: { status: 'error', selected: [], errors: [e.message], complete: false } }); } };
