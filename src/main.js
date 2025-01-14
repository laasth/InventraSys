import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { Logger } from './lib/logger'

// Initialize application with logging
Logger.info('Application starting', { timestamp: new Date().toISOString() });

const app = mount(App, {
  target: document.getElementById('app'),
})

// Log successful mount
Logger.info('Application mounted successfully', {
  target: 'app',
  environment: import.meta.env.MODE
});

export default app
