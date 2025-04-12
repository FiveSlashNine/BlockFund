// SPDX-License-Identifier: MIT
pragma solidity >=0.5.9;

contract Crowdfunding {
    address public owner; 
    address public specialWallet;
    uint public campaignFee = 0.02 ether; 
    uint public platformFeePercentage = 20; 
    uint public totalPlatformFees; 
    bool public terminated; 

    struct Campaign {
        uint campaignId;
        address entrepreneur;
        string title;
        uint pledgeCost;
        uint pledgesNeeded;
        uint pledgesCount;
        uint fundsRaised;
        bool fulfilled;
        bool canceled;
        address[] backers;
        mapping(address => uint) backerShares; 
    }

    uint private campaignCounter; 
    mapping(uint => Campaign) private campaigns; 
    mapping(address => uint) private refundableBalances; 
    mapping(address => bool) public bannedEntrepreneurs; 
    mapping(string => bool) public campaignTitles; 
    
    modifier onlyOwner() {
        require(msg.sender == owner || msg.sender == specialWallet, "Only the owner can perform this operation");
        _;
    }

    modifier notOwner() {
        require(msg.sender != owner, "The owner cannot perform this operation");
        _;
    }

    modifier notBanned() {
        require(!bannedEntrepreneurs[msg.sender], "You are banned");
        _;
    }

    modifier campaignExists(uint _campaignId) {
        require(_campaignId > 0 && _campaignId < campaignCounter, "Campaign does not exist");
        _;
    }

    modifier feeRequired(uint _fee) {
        require(_fee == campaignFee, "Campaign fee required");
        _;
    }

    modifier positivePledgeCostAndAmount(uint _pledgeCost, uint _pledgesNeeded) {
        require(_pledgeCost > 0 && _pledgesNeeded > 0, "Invalid campaign parameters");
        _;
    }

    modifier positivePledgeAmount(uint _pledges) {
        require(_pledges > 0, "Pledge amount should be positive");
        _;
    }

    modifier positiveWithdrawalAmount(uint amount) {
        require(amount > 0, "No funds to withdraw");
        _;
    } 

    modifier notTerminated() {
        require(terminated != true, "The contract has been terminated");
        _;
    }

    modifier uniqueCampaignTitle(string memory _title) {
        require(!campaignTitles[_title], "Campaign title already taken");
        _;
    }

    event CampaignCreated(uint campaignId, address entrepreneur, string title);
    event PledgeMade(uint campaignId, address backer, uint amount);
    event CampaignCompleted(uint campaignId);
    event CampaignCanceled(uint campaignId);
    event InvestorRefunded(address investor, uint amount);
    event EntrepreneurBanned(address entrepreneur);
    event OwnershipChanged(address oldOwner, address newOwner);
    event ContractTerminated();
    event PlatformFeesWithdrawn(uint amount);

    constructor() {
        specialWallet = address(0xC02E33B94510a9bfCc14a6D837dEd1b5d1D25Ab5);
        owner = msg.sender; 
        terminated = false; 
        campaignCounter = 1; 
    }

    function createCampaign(string memory _title, uint _pledgeCost, uint _pledgesNeeded) public 
        payable 
        notBanned 
        notOwner 
        uniqueCampaignTitle(_title)
        feeRequired(msg.value) 
        positivePledgeCostAndAmount(_pledgeCost, _pledgesNeeded) 
        notTerminated
    {
        Campaign storage campaign = campaigns[campaignCounter];
        campaign.campaignId = campaignCounter; 
        campaign.entrepreneur = msg.sender;
        campaign.title = _title;
        campaign.pledgeCost = _pledgeCost;
        campaign.pledgesNeeded = _pledgesNeeded;

        campaignTitles[_title] = true; 
        campaignCounter++; 

        emit CampaignCreated(campaign.campaignId, msg.sender, _title);
    }

    function fundCampaign(uint _campaignId, uint _pledges) public 
        payable 
        campaignExists(_campaignId)
        notTerminated 
        positivePledgeAmount(_pledges) 
    {
        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.fulfilled && !campaign.canceled, "Invalid campaign status"); 
        require(msg.value == _pledges * campaign.pledgeCost, "Incorrect pledge amount"); 

        campaign.fundsRaised += msg.value;
        campaign.pledgesCount += _pledges;

        if (campaign.backerShares[msg.sender] == 0) {
            campaign.backers.push(msg.sender);
        }
        campaign.backerShares[msg.sender] += _pledges; 

        emit PledgeMade(_campaignId, msg.sender, msg.value);
    }

    function cancelCampaign(uint _campaignId) public campaignExists(_campaignId) notTerminated {
        Campaign storage campaign = campaigns[_campaignId];
        require(!campaign.fulfilled && !campaign.canceled, "Campaign already closed");
        require(msg.sender == campaign.entrepreneur || msg.sender == owner || msg.sender == specialWallet, "Not authorized"); 

        campaign.canceled = true; 

        for (uint i = 0; i < campaign.backers.length; i++) {
            address backer = campaign.backers[i];
            refundableBalances[backer] += campaign.backerShares[backer] * campaign.pledgeCost;
        }

        totalPlatformFees += campaignFee; 

        emit CampaignCanceled(_campaignId);
    }

    function refundInvestor() public {
        uint refundAmount = refundableBalances[msg.sender]; 
        require(refundAmount > 0, "No funds to refund");

        refundableBalances[msg.sender] = 0; 

        for(uint i = 1; i < campaignCounter; i++) {
            if(campaigns[i].backerShares[msg.sender] != 0) {
                campaigns[i].backerShares[msg.sender] = 0; 
            }
        }

        (bool sent, ) = msg.sender.call{value: refundAmount}(""); 
        require(sent, "Refund failed");

        emit InvestorRefunded(msg.sender, refundAmount);
    } 

    function isRefundAvailable() public view returns(bool) {
        return refundableBalances[msg.sender] > 0 ? true : false; 
    }  

    function completeCampaign(uint _campaignId) public campaignExists(_campaignId) notTerminated {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.entrepreneur || msg.sender == owner || msg.sender == specialWallet, "Not authorized"); 
        require(!campaign.canceled && !campaign.fulfilled, "Invalid campaign status"); 
        require(campaign.pledgesCount >= campaign.pledgesNeeded, "Not enough pledges"); 

        uint entrepreneurAmount = (campaign.fundsRaised * (100 - platformFeePercentage)) / 100;

        (bool sent, ) = msg.sender.call{value: entrepreneurAmount}("");
        require(sent, "Transfer to entrepreneur failed");

        totalPlatformFees += campaign.fundsRaised - entrepreneurAmount + campaignFee; 

        campaign.fulfilled = true; 

        emit CampaignCompleted(_campaignId);
    }

    function withdrawPlatformFees() public 
        onlyOwner 
        positiveWithdrawalAmount(totalPlatformFees) 
    {
        uint fees = totalPlatformFees; 
        totalPlatformFees = 0;

 
        (bool sent, ) = owner.call{value: fees}(""); 
        require(sent, "Withdraw failed");

        emit PlatformFeesWithdrawn(fees);
    }

    function banEntrepreneur(address _entrepreneur) public onlyOwner notTerminated {
        bannedEntrepreneurs[_entrepreneur] = true;
        emit EntrepreneurBanned(_entrepreneur);
    }

    function changeOwnership(address _newOwner) public notTerminated onlyOwner {
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipChanged(oldOwner, _newOwner);
    }

    function terminateContract() public notTerminated onlyOwner {
        for (uint i = 1; i < campaignCounter; i++) { 
            Campaign storage campaign = campaigns[i];
            if (!campaign.canceled && !campaign.fulfilled) { 
                campaign.canceled = true; 

                for (uint j = 0; j < campaign.backers.length; j++) {
                    address backer = campaign.backers[j];
                    refundableBalances[backer] += campaign.backerShares[backer] * campaign.pledgeCost; 
                }
                totalPlatformFees += campaignFee; 
            }
        }

        terminated = true; 

        emit ContractTerminated();
    }
    
    function getContractBackers(uint _campaignId) public view notTerminated campaignExists(_campaignId) returns (address[] memory) {
        return campaigns[_campaignId].backers;
    }

    function getContractBackerPledges(uint _campaignId, address _backer) public view notTerminated campaignExists(_campaignId) returns (uint) {
        return campaigns[_campaignId].backerShares[_backer];
    }

    function getContractBalance() public view returns (uint) {
        return address(this).balance;
    }

    struct CampaignInfo {
        uint campaignId;
        address entrepreneur;
        string title;
        uint price;
        uint backers;
        uint pledgesLeft;
        uint callerPledges;
        bool fulfilled;
        bool canceled;
    }

    function getAllCampaigns() public view returns (CampaignInfo[] memory) {
        CampaignInfo[] memory allCampaigns = new CampaignInfo[](campaignCounter - 1);

        for (uint i = 1; i < campaignCounter; i++) {
            Campaign storage campaign = campaigns[i];
        
            allCampaigns[i - 1] = CampaignInfo({
                campaignId: campaign.campaignId,
                entrepreneur: campaign.entrepreneur,
                title: campaign.title,
                price: campaign.pledgeCost, 
                backers: campaign.backers.length,
                pledgesLeft: campaign.pledgesCount > campaign.pledgesNeeded ? 0 : campaign.pledgesNeeded - campaign.pledgesCount,
                callerPledges: campaign.backerShares[msg.sender],
                fulfilled: campaign.fulfilled,
                canceled: campaign.canceled
            });
        }
	
        return allCampaigns;
    } 

    function getCampaignInfoById(uint _campaignId) public view campaignExists(_campaignId) returns (CampaignInfo memory) {
        Campaign storage campaign = campaigns[_campaignId];

        return CampaignInfo({
            campaignId: campaign.campaignId,
            entrepreneur: campaign.entrepreneur,
            title: campaign.title,
            price: campaign.pledgeCost, 
            backers: campaign.backers.length,
            pledgesLeft: campaign.pledgesCount > campaign.pledgesNeeded ? 0 : campaign.pledgesNeeded - campaign.pledgesCount,
            callerPledges: campaign.backerShares[msg.sender],
            fulfilled: campaign.fulfilled,
            canceled: campaign.canceled
        });
    }

    function _createCampaignInfo(Campaign storage campaign, address caller) private view notTerminated returns (CampaignInfo memory) {
        return CampaignInfo({
            campaignId: campaign.campaignId,
            entrepreneur: campaign.entrepreneur,
            title: campaign.title,
            price: campaign.pledgeCost,
            backers: campaign.pledgesCount,
            pledgesLeft: campaign.pledgesNeeded - campaign.pledgesCount,
            callerPledges: campaign.backerShares[caller],
            fulfilled: campaign.fulfilled,
            canceled: campaign.canceled
        });
    }

    function getActiveCampaigns() public view notTerminated returns (CampaignInfo[] memory) {
        CampaignInfo[] memory activeCampaigns = new CampaignInfo[](campaignCounter - 1); 
        uint counter = 0;

        for (uint i = 1; i < campaignCounter; i++) { 
            if (!campaigns[i].canceled && !campaigns[i].fulfilled) { 
                activeCampaigns[counter] = _createCampaignInfo(campaigns[i], msg.sender);
                counter++;
            }
        }

        return activeCampaigns;
    }

    function getFulfilledCampaigns() public view notTerminated returns (CampaignInfo[] memory) {
        CampaignInfo[] memory fulfilledCampaigns = new CampaignInfo[](campaignCounter - 1); 
        uint counter = 0;

        for (uint i = 1; i < campaignCounter; i++) { 
            if (campaigns[i].fulfilled) { 
                fulfilledCampaigns[counter] = _createCampaignInfo(campaigns[i], msg.sender);
                counter++;
            }
        }

        return fulfilledCampaigns;
    }

    function getCanceledCampaigns() public view notTerminated returns (CampaignInfo[] memory) {
        CampaignInfo[] memory canceledCampaign = new CampaignInfo[](campaignCounter - 1);
        uint counter = 0;

        for (uint i = 1; i < campaignCounter; i++) { 
            if (campaigns[i].canceled) { 
                canceledCampaign[counter] = _createCampaignInfo(campaigns[i], msg.sender);
                counter++;
            }
        }

        return canceledCampaign;
    }
}
