import React from 'react';

interface Props {
  children?: React.ReactNode;
}

const BookingArea: React.FC<Props> = ({ children }) => {
  return <div className="pool-booking-area">{children}</div>;
};

export default BookingArea;