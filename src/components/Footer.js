import React, { useEffect, useState } from 'react';
import './Footer.css';

const Footer = () => {
  const messages = [
    'know that you are loved',
    'all roads lead to rome',
    'momento mori'
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="footer">
      <span><strong>Made by Shammah</strong></span>
      <span className="dot">•</span>
      <span>{messages[index]}</span>
    </div>
  );
};

export default Footer;
