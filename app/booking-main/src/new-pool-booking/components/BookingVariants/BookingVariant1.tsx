import React from "react";
import "./BookingVariant1.css";
import PoolWorkload1 from "./PoolWorkload1";
import BookingApp from "../Booking/BookingApp"; // путь скорректируйте под вашу структуру

const BookingVariant1: React.FC = () => (
  <div className="booking-variant1-row">
    <div className="booking-variant1-chart">
      <PoolWorkload1 />
    </div>
    <div className="booking-variant1-side">
      <BookingApp />
    </div>
  </div>
);

export default BookingVariant1;