import React from 'react';

function ChannelForm(props) {

  const {
    openPaymentRecipient,
    openPaymentAmount,
    openChannel,
    handleFormChange
  } = props;

  return(
    <form onSubmit={e => e.preventDefault()}>
      <label>
        Enter Channel Recipient
        <input
          type="text"
          placeholder="recipient address 0x.."
          value={openPaymentRecipient}
          onChange={e => handleFormChange('openPaymentRecipient', e.target.value)} />
      </label>

      <label>
        Enter Channel Value
        <input
          type="text"
          placeholder="amount in ETH"
          value={openPaymentAmount}
          onChange={e => handleFormChange('openPaymentAmount', e.target.value)} />
      </label>

      <button className="App__button--primary" onClick={openChannel}>
        Open Channel
      </button>
    </form>
  )
}

export default ChannelForm;
