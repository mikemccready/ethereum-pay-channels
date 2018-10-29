contract UnidirectionalPaymentChannel {
    address public sender;
    address public recipient;

    constructor (address _recipient) payable public {
        sender = msg.sender;
        recipient = _recipient;
    }

    function closeChannel(uint256 _amount) {
        recipient.transfer(_amount);
        selfdestruct(sender);
    }
}
