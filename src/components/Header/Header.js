import React from 'react';

import './Header.css';

function Header (props) {
  const { address } = props;

  return (
    <div className="Header">
      <h1>++</h1>
      <p>signed in: { address }</p>
    </div>
  )
}

export default Header;
