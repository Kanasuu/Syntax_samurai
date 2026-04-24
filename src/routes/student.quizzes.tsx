import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { chatWithGroq, parseJsonResponse } from "@/lib/groq";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, Loader2, CheckCircle, XCircle, RotateCcw,
  Timer, Trophy, Sparkles, Target, ArrowRight
} from "lucide-react";

export const Route = createFileRoute("/student/quizzes")({ component: PracticeQuizzes });

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // 0-indexed
  explanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  answers: (number | null)[];
  submitted: boolean;
  startTime: number;
}

const TOPICS = [
  "Data Structures & Algorithms",
  "Python Programming",
  "JavaScript & React",
  "SQL & Databases",
  "Object Oriented Programming",
  "Operating Systems",
  "Computer Networks",
  "Aptitude & Reasoning",
  "Machine Learning Basics",
  "System Design Basics",
  "Java Programming",
  "Web Development",
];

function PracticeQuizzes() {
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [history, setHistory] = useState<{ topic: string; score: number; total: number; time: number; date: string }[]>([]);

  const generateQuiz = async () => {
    const selectedTopic = topic === "custom" ? customTopic : topic;
    if (!selectedTopic) return;
    setLoading(true);
    setError("");
    setQuiz(null);

    try {
      const response = await chatWithGroq([
        {
          role: "system",
          content: `You are a quiz generator for placement preparation. Return ONLY valid JSON array, no other text. Each item must match:
{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct": 0, "explanation": "why this answer is correct"}
"correct" is the 0-based index of the correct option. Generate exactly ${questionCount} questions at ${difficulty} difficulty. Make questions placement-interview relevant.`
        },
        {
          role: "user",
          content: `Generate a ${difficulty} difficulty quiz on: ${selectedTopic}`
        }
      ], { temperature: 0.8, max_tokens: 3000 });

      const questions = parseJsonResponse<QuizQuestion[]>(response);
      setQuiz({
        questions,
        answers: new Array(questions.length).fill(null),
        submitted: false,
        startTime: Date.now(),
      });
    } catch (e: any) {
      setError(e.message || "Failed to generate quiz");
    }
    setLoading(false);
  };

  const selectAnswer = (qIndex: number, optIndex: number) => {
    if (!quiz || quiz.submitted) return;
    const newAnswers = [...quiz.answers];
    newAnswers[qIndex] = optIndex;
    setQuiz({ ...quiz, answers: newAnswers });
  };

  const submitQuiz = () => {
    if (!quiz) return;
    const timeTaken = Math.round((Date.now() - quiz.startTime) / 1000);
    const score = quiz.questions.reduce((s, q, i) => s + (quiz.answers[i] === q.correct ? 1 : 0), 0);
    setQuiz({ ...quiz, submitted: true });
    setHistory((h) => [
      { topic: topic === "custom" ? customTopic : topic, score, total: quiz.questions.length, time: timeTaken, date: new Date().toISOString() },
      ...h,
    ]);
  };

  const score = quiz?.submitted
    ? quiz.questions.reduce((s, q, i) => s + (quiz.answers[i] === q.correct ? 1 : 0), 0)
    : 0;

  const scorePercent = quiz?.submitted ? Math.round((score / quiz.questions.length) * 100) : 0;

  const reset = () => { setQuiz(null); setError(""); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl flex items-center gap-2">
          <Brain className="h-8 w-8 text-accent" /> Practice Quizzes
        </h1>
        <p className="text-muted-foreground">AI-generated quizzes to test your placement readiness.</p>
      </div>

      {/* Quiz setup */}
      {!quiz && (
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Configure Your Quiz
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-muted-foreground">Topic</label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger><SelectValue placeholder="Select a topic…" /></SelectTrigger>
                <SelectContent>
                  {TOPICS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  <SelectItem value="custom">✏️ Custom topic…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Difficulty</label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">🟢 Easy</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="hard">🔴 Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Questions</label>
              <Select value={questionCount} onValueChange={setQuestionCount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 questions</SelectItem>
                  <SelectItem value="10">10 questions</SelectItem>
                  <SelectItem value="15">15 questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {topic === "custom" && (
            <Input placeholder="Enter your custom topic (e.g., React Hooks, Binary Trees)…" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} />
          )}
          <Button onClick={generateQuiz} disabled={loading || (!topic || (topic === "custom" && !customTopic))} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? "Generating quiz…" : "Start Quiz"}
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
          <p className="text-sm text-muted-foreground mt-3">AI is crafting your quiz…</p>
        </div>
      )}

      {/* Quiz in progress */}
      {quiz && !loading && (
        <div className="space-y-4">
          {/* Score banner (post-submit) */}
          {quiz.submitted && (
            <div className={`rounded-xl border p-6 text-center ${scorePercent >= 70 ? "bg-green-50 border-green-200" : scorePercent >= 40 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
              <Trophy className={`h-10 w-10 mx-auto ${scorePercent >= 70 ? "text-green-500" : scorePercent >= 40 ? "text-amber-500" : "text-red-500"}`} />
              <div className="font-display text-4xl mt-2">{score}/{quiz.questions.length}</div>
              <div className="text-sm text-muted-foreground">
                {scorePercent}% · {Math.round((Date.now() - quiz.startTime) / 1000)}s
              </div>
              <div className="text-sm mt-2 font-medium">
                {scorePercent >= 80 ? "🎉 Excellent! You're well prepared!" : scorePercent >= 60 ? "👍 Good job! Keep practicing!" : scorePercent >= 40 ? "📚 Decent, but needs more work." : "💪 Don't give up! Review and try again."}
              </div>
              <Button onClick={reset} variant="outline" className="mt-4 gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Take Another Quiz
              </Button>
            </div>
          )}

          {/* Questions */}
          {quiz.questions.map((q, qi) => {
            const answered = quiz.answers[qi] !== null;
            const isCorrect = quiz.submitted && quiz.answers[qi] === q.correct;
            const isWrong = quiz.submitted && answered && quiz.answers[qi] !== q.correct;
            return (
              <div key={qi} className={`rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] ${isCorrect ? "border-green-200" : isWrong ? "border-red-200" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-secondary text-xs grid place-items-center shrink-0 font-medium">{qi + 1}</div>
                  <div className="flex-1 space-y-3">
                    <p className="text-sm font-medium">{q.question}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oi) => {
                        const selected = quiz.answers[qi] === oi;
                        const isThisCorrect = quiz.submitted && oi === q.correct;
                        const isThisWrong = quiz.submitted && selected && oi !== q.correct;
                        return (
                          <button
                            key={oi}
                            onClick={() => selectAnswer(qi, oi)}
                            disabled={quiz.submitted}
                            className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-all flex items-center gap-2
                              ${isThisCorrect ? "border-green-400 bg-green-50 text-green-800" : ""}
                              ${isThisWrong ? "border-red-400 bg-red-50 text-red-800" : ""}
                              ${!quiz.submitted && selected ? "border-primary bg-primary/10 ring-1 ring-primary" : ""}
                              ${!quiz.submitted && !selected ? "hover:border-primary/50 hover:bg-muted/40" : ""}
                            `}
                          >
                            {isThisCorrect && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                            {isThisWrong && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                            {!quiz.submitted && <span className="h-4 w-4 rounded-full border-2 shrink-0 grid place-items-center">{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span>}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                    {quiz.submitted && (
                      <div className={`text-xs px-3 py-2 rounded-lg ${isCorrect ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                        <span className="font-medium">Explanation:</span> {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Submit button */}
          {!quiz.submitted && (
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{quiz.answers.filter((a) => a !== null).length}/{quiz.questions.length} answered</span>
                <Button onClick={submitQuiz} disabled={quiz.answers.some((a) => a === null)} className="gap-1.5">
                  <Target className="h-4 w-4" /> Submit Quiz
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Score history */}
      {history.length > 0 && !quiz && (
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-accent" /> Recent Scores
          </h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <span className="font-medium">{h.topic}</span>
                  <span className="text-xs text-muted-foreground ml-2">{h.time}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${Math.round((h.score / h.total) * 100) >= 70 ? "bg-green-100 text-green-800" : Math.round((h.score / h.total) * 100) >= 40 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {h.score}/{h.total}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
