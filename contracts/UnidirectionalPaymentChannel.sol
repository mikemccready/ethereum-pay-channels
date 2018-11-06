contract UnidirectionalPaymentChannel {
    // track channel id
    uint256 public channelIndex;

    struct Channel {
        uint256 id;
        address sender;         // address of payer
        address recipient;      // address of payee
        uint256 deposit;        // initial channel value
        string  status;         // TODO: enum
    }

    // map of all channels
    mapping(uint256 => Channel) public channels;

    // index channels where user is sender
    mapping(address => uint256[]) public senderChannels;
    mapping(address => uint256) public senderChannelIndex;

    // index channels where user is recipient
    mapping(address => uint256[]) public recipientChannels;
    mapping(address => uint256) public recipientChannelIndex;

    // init contract and channelIndex
    constructor() public {
        channelIndex = 0;
    }

    // open a new channel, called by the sender
    function openChannel(address _recipient) public payable {
        // define new channel properties
        Channel memory newChannel = Channel(
            {
                id: channelIndex,
                sender: msg.sender,
                recipient: _recipient,
                deposit: msg.value,
                status: 'open'
            }
        );

        // add channel to channel maps
        channels[channelIndex] = newChannel;
        senderChannels[msg.sender].push(channelIndex);
        recipientChannels[_recipient].push(channelIndex);

        // increment channel indexes
        channelIndex++;
        senderChannelIndex[msg.sender]++;
        recipientChannelIndex[_recipient]++;
    }

    // close payment channel, called by recipient
    function closeChannel(
        uint256 _channelSpend,
        uint256 _channelId,
        bytes _signature,
        address _sender
    )
        public
        returns (bool success)
    {
        Channel storage closingChannel = channels[_channelId];

        // must be called by recipient
        // expected sender must match channel sender
        // channel status must be open
        require(closingChannel.recipient == msg.sender);
        require(closingChannel.sender == _sender);
        require(keccak256(closingChannel.status) == keccak256('open'));

        // init local variables
        bytes32 r;
        bytes32 s;
        uint8 v;
        bytes32 message;
        bytes32 hash;
        address signerAddress;
        uint256 returnAmount;

        // parse signature
        assembly {
            r := mload(add(_signature, 32))             // first 32 bytes
            s := mload(add(_signature, 64))             // second 32 bytes
            v := byte(0, mload(add(_signature, 96)))    // final byte
        }

        // recreate message with expected parameters
        // add signing prefix to message
        message = keccak256(abi.encodePacked(_channelSpend, _channelId));
        hash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );

        // recover signer address given signature and expected message
        // recovered address must match the expected signer to be valid
        signerAddress = ecrecover(hash, v, r, s);
        require(signerAddress == _sender);

        // calculate amount to return to sender
        returnAmount = closingChannel.deposit - _channelSpend;

        // settle balances
        closingChannel.recipient.transfer(_channelSpend);
        closingChannel.sender.transfer(returnAmount);

        // update channel status
        channels[_channelId].status = 'closed';

        return true;
    }
}
