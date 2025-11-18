import '../../wheel/src/styles.css';
import './styles.css';

import React from "react";
import { createRoot } from 'react-dom/client';
import WizardApp from './WizardApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<WizardApp />);
}