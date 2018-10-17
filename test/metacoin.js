var MetaCoin = artifacts.require("./MetaCoin.sol");
require('truffle-test-utils').init();

contract('MetaCoin', function(accounts) {
  let instance;
  let cost;
  let answer;
  let questionText;
  let owner = accounts[0];
  let account = accounts[1];
  let friend = accounts[2];

  beforeEach(async () => {
    instance =  await MetaCoin.new({ from: owner });
    questionText = "What is the meaning of life?";
    cost = 10;
    answer = "42";
  });

  describe("Set up", async () => {
    it("should put 10000 MetaCoin as the total supply", async () => {
      let result = await instance.totalSupply.call();
      assert.equal(result.valueOf(), 12000, "12000 wasn't the total supply");
    });
    it("should give initial balance to owner", async () => {
      let result = await instance.balanceOf.call(owner);
      assert.equal(result.valueOf(), 12000, "owner has no supply");
    });
  });
  describe("Ownable question cost setting", async () => {
    it ("should let owner set question cost", async () => {
      await instance.setQuestionCost(cost);
      let result = await instance.getQuestionCost();
      assert.equal(result, cost, "Cost wasn't set");
    });
    it("should not allow non-owners to set question cost", async () => {
        try {
          let result = await instance.setQuestionCost(cost, {from: account})
        } catch (e) {
          assert.notEqual(e, undefined, 'Exception was not  thrown');
        }
    });
  });
  describe("Question asking", async () => {
    it("should not allow creation if question cost is higher than owner's balance", async () => {
      // arrange
      let totalSupply = await instance.totalSupply.call();
      await instance.setQuestionCost(totalSupply * 10);

      // act
      let result = await instance.askQuestion.call(questionText, [account]);
      assert.equal(result.valueOf(), false);

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.equal(questionCount.valueOf(), 0, "A question was created");
    });
    it("should emit failure event if question cost is higher than owner's balance", async () => {
      // arrange
      let totalSupply = await instance.totalSupply.call();
      await instance.setQuestionCost(totalSupply * 10);

      // act
      let result = await instance.askQuestion(questionText, [account]);

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'QuestionFailed',
          args: {
            _asker: owner,
            _reason: "Could not afford question"
        }
      }, 'The event is emitted');
    });
    it("allows for successful question creation", async () => {
      await instance.setQuestionCost(cost);

      // act
      let result = await instance.askQuestion(questionText, [account]);

      // assertions
      let   questionCount = await instance.getQuestionCount.call();
      assert.equal(questionCount.valueOf(), 1, "A question was not created");

      let questionObj = await instance.getQuestionByID.call(0).valueOf();
      assert.equal(questionObj[0], questionText, 'the question is wrong');
      assert.equal(questionObj[1], false, 'flag was not set');
    });
    it("should deduct questionCost from balance of sender", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      let inital_balance =  await instance.balanceOf.call(owner).valueOf();

      // act
      await instance.askQuestion(questionText, [account]);

      // assert
      let new_balance = await instance.balanceOf.call(owner).valueOf();
      assert.equal(new_balance, 12000 - 10, 'Wrong or no amount was deducted');
    });
    it("should emit success event if question is asked", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      let inital_balance =  await instance.balanceOf.call(owner).valueOf();

      // act
      let result = await instance.askQuestion(questionText, [account]);

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'QuestionAsked',
          args: {
            _question: questionText,
            _value: 10,
            _id: 0,
        }
      }, 'The event is emitted');
    });
  });
  describe("Question Answering", async () => {
    it("should emit success event if question is answered", async () => {
      await instance.setQuestionCost(cost);

      // act
      await instance.askQuestion(questionText, [account]);
      let result = await instance.answerQuestion(0, answer, {from: account});

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'Answered',
          args: {
            _question: questionText,
            _answer: answer,
            _value: 10,
            _id: 0,
        }
      }, 'The event is emitted');
    });
    it("should pay user for answering a question", async () => {
      // arrange
      await instance.setQuestionCost(cost);

      // act
      await instance.askQuestion(questionText, [account]);
      await instance.answerQuestion(0, answer, {from: account});

      // assert
      let new_balance = await instance.balanceOf.call(account).valueOf();
      assert.equal(new_balance, cost, 'Answerer did not get money');
    });
    it("should mark answered question as marked and set answer", async () => {
      await instance.setQuestionCost(cost);

      // act
      await instance.askQuestion(questionText, [account]);
      await instance.answerQuestion(0, answer, {from: account});

      // assert
      let questionObj = await instance.getQuestionByID.call(0).valueOf();
      assert.equal(questionObj[0], questionText, 'the question is wrong');
      assert.equal(questionObj[1], true, 'flag was not set');
      assert.equal(questionObj[2], answer, 'answer is wrong');
    });
    it("should not allow answering of answered questions", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      await instance.askQuestion(questionText, [account]);
      await instance.answerQuestion(0, answer);

      //act
      let result = await instance.answerQuestion.call(0, answer);

      // assert
      assert.equal(result.valueOf(), false, 'repeat answer should not work');
    });
    it("should emit failed event if question is answered", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      await instance.askQuestion(questionText, [account]);
      await instance.answerQuestion(0, answer, {from: account});

      //act
      let result = await instance.answerQuestion(0, answer, {from: account});

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'AnswerFailed',
          args: {
            _answerer: account,
            _reason: "Gah, this one has been done",
            _id: 0,
        }
      }, 'The event is emitted');
    });
    it("should not allow answering questions with invalid index", async () => {
      //act
      let result = await instance.answerQuestion.call(0, answer);

      // assert
      assert.equal(result.valueOf(), false, 'repeat answer should not work');
    });
    it("should emit failed event if invalid index", async () => {
      // arrange
      let result = await instance.answerQuestion(0, answer);

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'AnswerFailed',
          args: {
            _answerer: owner,
            _reason: "Invalid id of question",
            _id: 0,
        }
      }, 'The event is emitted');
    });
    it("should not allow answering questions with no answer", async () => {
      //act
      let result = await instance.answerQuestion.call(0, "");

      // assert
      assert.equal(result.valueOf(), false, 'repeat answer should not work');
    });
    it("should emit failed event if no answer", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      await instance.askQuestion(questionText, [account]);
      let result = await instance.answerQuestion(0, "");

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'AnswerFailed',
          args: {
            _answerer: owner,
            _reason: "Please answer the question",
            _id: 0,
        }
      }, 'The event is emitted');
    });
    it("should not allow answering by non answerers", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      await instance.askQuestion(questionText, [account]);
      let result = await instance.answerQuestion.call(0, answer, {from: friend});

      // assert
      assert.equal(result.valueOf(), false, 'friend should not answer');
    });
    it("should emit failed event if bad answerer", async () => {
      // arrange
      await instance.setQuestionCost(cost);
      await instance.askQuestion(questionText, [account]);
      let result = await instance.answerQuestion(0, answer, {from: friend});

      // assert
      let questionCount = await instance.getQuestionCount.call();
      assert.web3Event(result, {
        event: 'AnswerFailed',
          args: {
            _answerer: friend,
            _reason: "Your opinion does not mean much",
            _id: 0,
        }
      }, 'The event is emitted');
    });
  });
});
