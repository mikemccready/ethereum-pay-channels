import React from 'react';

import './Overlay.css';

function Overlay(props) {
  const { display } = props;

  return(
    <div className="Overlay">
      <div className="Overlay__pattern" />
        {
          display === 'signin' &&
          <div className="Overlay__content">
            <h3>
              Please sign into&nbsp;
              <a
                target="_blank"
                href="https://metamask.io/"
                rel="noopener noreferrer">
                MetaMask
              </a>
            </h3>
            <h1>psss.. test on ropsten network</h1>
          </div>
        }

        {
          display === 'busy' &&
          <div className="Overlay__content">
            <h3>Blockchaining, please standby..</h3>
            <h1>Confirm with your metamask wallet</h1>
          </div>
        }
    </div>
  )
}

export default Overlay
