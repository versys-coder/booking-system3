import React from 'react';
import PoolBookingPage from './new-pool-booking/PoolBookingPage';
import PoolWheelWidgetEmbed from './embed/PoolWheelWidgetEmbed';

function App() {
  const sp = new URLSearchParams(window.location.search);
  const isEmbedParam = sp.get('embed') === 'minimal';
  const isEmbedPath = window.location.pathname.startsWith('/embed');

  if (isEmbedParam || isEmbedPath) {
    return <PoolWheelWidgetEmbed />;
  }
  return <PoolBookingPage />;
}

export default App;