import { createRoot } from 'react-dom/client';
import { Display } from './Display';
import './style.css';
import './ui.css';
createRoot(document.getElementById('root')!).render(<Display published />);
