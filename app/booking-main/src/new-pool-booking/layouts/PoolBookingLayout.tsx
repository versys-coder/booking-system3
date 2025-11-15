import React from 'react';

interface Props {
  children?: React.ReactNode;
}

const PoolBookingLayout: React.FC<Props> = ({ children }) => {
  return <div className="pool-root">{children}</div>;
};

export default PoolBookingLayout;