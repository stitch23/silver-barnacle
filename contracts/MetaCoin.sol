pragma solidity ^0.4.18;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MetaCoin is Ownable, MintableToken {
	// 8ball specific
	uint questionCost;
	Question[] questions;
	mapping(uint => address[]) public answerers; // we will limit answerers to 10

	// ERC20 stuff
	string symbol = "META";
	string name = "MetaToken";
	uint8 public decimals = 2;
	uint256 public constant INITIAL_SUPPLY = 12000;

	event QuestionAsked(string _question, uint _value, uint _id);
	event QuestionFailed(address _asker, string _reason);
	event Answered(string _question, string _answer, uint _value, uint _id);
	event AnswerFailed(address _answerer, string _reason, uint _id);
	event Debug(uint _test);

	constructor() public {
		mint(msg.sender, INITIAL_SUPPLY);
	}

	struct Question {
		string question;
		uint value;
		bool isAnswered;
		string answer;
	}

	function askQuestion(string question, address[] assignees) external returns (bool) {
		// assert that sender can pay
		if (balanceOf(msg.sender) < questionCost) {
			emit QuestionFailed(msg.sender, "Could not afford question");
			return false;
		}
		// TODO make assignee limit dynamic
		if (assignees.length > 10) {
			emit QuestionFailed(msg.sender, "too many assignees");
			return false;
		}

		// transfer
		transfer(address(this), questionCost);

		// clean up
		answerers[questions.length] = assignees;
		questions.push(Question(question, questionCost, false, ""));
		emit QuestionAsked(question, questionCost, questions.length - 1);
		return true;
	}

	function setQuestionCost(uint cost) external onlyOwner {
		questionCost = cost;
	}

	function getQuestionCost() public view returns (uint) {
		return questionCost;
	}

	function getQuestionCount() public view returns (uint) {
		return questions.length;
	}

	function getMappingForQuestion(uint question_id) external onlyOwner returns (address[]) {
		return answerers[question_id];
	}

	function canAnswer(address[] assignees, address sender) private pure returns (bool) {
		for (uint i=0; i< assignees.length; i++) {
  		if (assignees[i] == sender) {
				return true;
			}
		}
		return false;
	}

	function getQuestionByID(uint question_id) public view returns (string question,
		bool isAnswered,
		string answer
	) {
		require(question_id + 1 <= questions.length);
		Question memory q = questions[question_id];
		return (q.question, q.isAnswered, q.answer);
	}

	function answerQuestion(uint question_id, string answer) public returns (bool) {
		// do checks
		if (question_id + 1 > questions.length) {
			emit AnswerFailed(msg.sender, "Invalid id of question", question_id);
			return false;
		}
		if (keccak256(abi.encodePacked(answer)) == keccak256("")) {
			emit AnswerFailed(msg.sender, "Please answer the question", question_id);
			return false;
		}
		if (questions[question_id].isAnswered) {
			emit AnswerFailed(msg.sender, "Gah, this one has been done", question_id);
			return false;
		}
		address[] memory assignees = answerers[question_id];
		bool willAnswer = canAnswer(assignees, msg.sender);
		if (willAnswer == false) {
			emit AnswerFailed(msg.sender, "Your opinion does not mean much", question_id);
			return false;
		}
		Question storage q = questions[question_id];

		// transfer
		this.approve(msg.sender, q.value);
		transferFrom(address(this), msg.sender, q.value);

		// modify question
		q.isAnswered = true;
		q.answer = answer;
		emit Answered(q.question, q.answer, q.value, question_id);
	}
}
