import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "../input/Button";
import { Column } from "../layout/Column";
import styles from "./QuizPanel.scss";

function OptionButton({ index, label, selected, disabled, onSelect }) {
  return (
    <Button
      className={selected ? styles.optionSelected : styles.option}
      disabled={disabled}
      onClick={() => onSelect(index)}
    >
      {label}
    </Button>
  );
}

OptionButton.propTypes = {
  index: PropTypes.number.isRequired,
  label: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired
};

function TeacherView({ channel, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [title, setTitle] = useState("");

  const addOption = useCallback(() => {
    setOptions([...options, ""]);
  }, [options]);

  const updateOption = useCallback((i, val) => {
    setOptions(opts => opts.map((o, j) => (j === i ? val : o)));
  }, []);

  const removeOption = useCallback(
    i => {
      if (options.length > 2) {
        const newOpts = options.filter((_, j) => j !== i);
        setOptions(newOpts);
        if (correctIndex >= newOpts.length) setCorrectIndex(newOpts.length - 1);
      }
    },
    [options, correctIndex]
  );

  const startQuiz = useCallback(() => {
    if (!question.trim() || options.some(o => !o.trim())) return;
    channel.startQuiz(title || "Quiz", question, options, correctIndex);
    onClose();
  }, [channel, title, question, options, correctIndex, onClose]);

  return (
    <Column>
      <h3>Start Quiz</h3>
      <input
        className={styles.input}
        placeholder="Quiz title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <textarea
        className={styles.textarea}
        placeholder="Enter your question..."
        value={question}
        onChange={e => setQuestion(e.target.value)}
      />
      <div className={styles.optionsList}>
        {options.map((opt, i) => (
          <div key={i} className={styles.optionRow}>
            <input
              type="radio"
              name="correctIndex"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
            />
            <input
              className={styles.input}
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={e => updateOption(i, e.target.value)}
            />
            {options.length > 2 && (
              <button className={styles.removeBtn} onClick={() => removeOption(i)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <Button onClick={addOption}>+ Add Option</Button>
      <Button onClick={startQuiz} disabled={!question.trim() || options.some(o => !o.trim())}>
        Start Quiz
      </Button>
    </Column>
  );
}

TeacherView.propTypes = {
  channel: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
};

function StudentView({ quiz, channel }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  const submit = useCallback(async () => {
    if (selected === null) return;
    const res = await channel.submitAnswer(quiz.quiz_id, selected);
    setResult(res);
    setSubmitted(true);
  }, [channel, quiz, selected]);

  return (
    <Column>
      <h3>{quiz.title}</h3>
      <p className={styles.question}>{quiz.question}</p>
      {quiz.options.map((opt, i) => (
        <OptionButton
          key={i}
          index={i}
          label={opt}
          selected={selected === i}
          disabled={submitted}
          onSelect={setSelected}
        />
      ))}
      {!submitted && (
        <Button onClick={submit} disabled={selected === null}>
          Submit Answer
        </Button>
      )}
      {submitted && (
        <p className={result ? styles.correct : styles.incorrect}>
          {result ? "Correct!" : "Incorrect"}
        </p>
      )}
    </Column>
  );
}

StudentView.propTypes = {
  quiz: PropTypes.object.isRequired,
  channel: PropTypes.object.isRequired
};

function ResultsView({ quiz, channel, onClose }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    channel.getQuizResults(quiz.quiz_id).then(setResults);
  }, [channel, quiz]);

  if (!results) return <p>Loading results...</p>;

  const total = results.answers.length;
  const answerCounts = quiz.options.map((_, i) => results.answers.filter(a => a.answer_index === i).length);

  return (
    <Column>
      <h3>Results: {quiz.title}</h3>
      <p>{results.question}</p>
      <div className={styles.resultsList}>
        {quiz.options.map((opt, i) => (
          <div key={i} className={styles.resultRow}>
            <span className={i === results.correct_index ? styles.correctAnswer : ""}>
              {opt}
            </span>
            <span className={styles.count}>
              {total > 0 ? Math.round((answerCounts[i] / total) * 100) : 0}%
              <br />
              <small>({answerCounts[i]}/{total})</small>
            </span>
          </div>
        ))}
      </div>
      {results.correct_index !== undefined && (
        <p className={styles.hint}>
          Correct answer: {quiz.options[results.correct_index]} ({results.correct_count}/{total} correct)
        </p>
      )}
      <Button onClick={onClose}>Close</Button>
    </Column>
  );
}

ResultsView.propTypes = {
  quiz: PropTypes.object.isRequired,
  channel: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
};

export default function QuizPanel({ channel, canStartQuiz, onClose }) {
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [view, setView] = useState(null);
  const [quiz, setQuiz] = useState(null);

  useEffect(() => {
    const onStarted = ({ quiz_id, title, question, options }) => {
      setActiveQuiz({ quiz_id, title, question, options });
      setView("student");
    };
    const onEnded = () => {
      setActiveQuiz(null);
      setView(null);
    };

    channel.onQuizStarted(onStarted);
    channel.onQuizEnded(onEnded);

    return () => {
      channel.onQuizStarted(() => {});
      channel.onQuizEnded(() => {});
    };
  }, [channel]);

  if (view === "teacher") {
    return <TeacherView channel={channel} onClose={() => setView(null)} />;
  }

  if (view === "results") {
    return <ResultsView quiz={quiz} channel={channel} onClose={() => setView(null)} />;
  }

  if (activeQuiz && view === "student") {
    return <StudentView quiz={activeQuiz} channel={channel} />;
  }

  return (
    <Column>
      <h3>Quiz</h3>
      {canStartQuiz && (
        <Button onClick={() => setView("teacher")}>Start New Quiz</Button>
      )}
      {activeQuiz && (
        <Button onClick={() => {
          setView("student");
          setQuiz(activeQuiz);
        }}>
          {activeQuiz.title}
        </Button>
      )}
      {activeQuiz && (
        <Button onClick={() => {
          setView("results");
          setQuiz(activeQuiz);
        }}>
          View Results
        </Button>
      )}
      <Button onClick={onClose}>Close</Button>
    </Column>
  );
}

QuizPanel.propTypes = {
  channel: PropTypes.object.isRequired,
  canStartQuiz: PropTypes.bool,
  onClose: PropTypes.func.isRequired
};
