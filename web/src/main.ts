import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { app } from './lib/state.svelte';

app.restore();
mount(App, { target: document.getElementById('app')! });
