import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CreatePollModal from "./CreatePollModal";
import ActivePollOverlay from "./ActivePollOverlay";
import RecordedPollsModal from "./RecordedPollsModal";
import type { Poll } from "./types";

describe("CreatePollModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <CreatePollModal isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("applies a preset template when clicked", async () => {
    const user = userEvent.setup();
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const yesNoPreset = screen.getByRole("button", { name: /Yes \/ No/i });
    await user.click(yesNoPreset);

    const questionInput = screen.getByLabelText(/Poll Question \/ Prompt/i) as HTMLInputElement;
    expect(questionInput.value).toContain("Do you agree");

    const optionInputs = screen.getAllByPlaceholderText(/Option/i) as HTMLInputElement[];
    expect(optionInputs[0]?.value).toBe("Yes");
    expect(optionInputs[1]?.value).toBe("No");
  });

  it("allows adding and removing custom options", async () => {
    const user = userEvent.setup();
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getAllByPlaceholderText(/Option/i)).toHaveLength(2);

    const addBtn = screen.getByRole("button", { name: /Add Option/i });
    await user.click(addBtn);
    expect(screen.getAllByPlaceholderText(/Option/i)).toHaveLength(3);

    const removeBtns = screen.getAllByLabelText(/Remove option/i);
    await user.click(removeBtns[0]!);
    expect(screen.getAllByPlaceholderText(/Option/i)).toHaveLength(2);
  });

  it("shows error and prevents submission with empty question", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreatePollModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    const submitBtn = screen.getByRole("button", { name: /Launch Poll/i });
    await user.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Please provide a question/i);
  });

  it("blocks launch while a poll is active and re-enables it when that poll ends", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const props = { isOpen: true, onClose: vi.fn(), onSubmit };
    const { rerender } = render(<CreatePollModal {...props} hasActivePoll />);
    await user.click(screen.getByRole("button", { name: /Yes \/ No/i }));
    const launch = screen.getByRole("button", { name: /Launch Poll/i });
    expect(launch).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/End the current poll/i);
    await user.click(launch);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(<CreatePollModal {...props} hasActivePoll={false} />);
    expect(launch).toBeEnabled();
    await user.click(launch);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("submits valid poll data with duration and cleaned options", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<CreatePollModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Poll Question \/ Prompt/i), "Which framework?");
    const optionInputs = screen.getAllByPlaceholderText(/Option/i);
    await user.type(optionInputs[0]!, "React");
    await user.type(optionInputs[1]!, "Vue");

    await user.click(screen.getByRole("button", { name: "30s" }));

    await user.click(screen.getByRole("button", { name: /Launch Poll/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      question: "Which framework?",
      options: ["React", "Vue"],
      duration: 30,
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ActivePollOverlay", () => {
  const samplePoll: Poll = {
    id: "poll-1",
    sessionId: "sess-1",
    question: "Do you like this UI?",
    status: "ACTIVE",
    isRecorded: false,
    totalVotes: 10,
    createdAt: Date.now(),
    options: [
      { id: "opt-1", text: "Love it", order: 0, voteCount: 7, percentage: 70 },
      { id: "opt-2", text: "Needs work", order: 1, voteCount: 3, percentage: 30 },
    ],
  };

  it("shows voting buttons for participant who hasn't voted yet", async () => {
    const onVote = vi.fn();
    render(
      <ActivePollOverlay
        poll={samplePoll}
        isOrganizer={false}
        onVote={onVote}
        onEndPoll={vi.fn()}
        onRecordPoll={vi.fn()}
        onDismissPoll={vi.fn()}
        isConnected={true}
      />
    );

    expect(screen.getByText("Do you like this UI?")).toBeInTheDocument();
    expect(screen.getByText("Tap an option above to submit your vote!")).toBeInTheDocument();

    const voteButtons = screen.getAllByRole("button", { name: /Love it|Needs work/i });
    fireEvent.click(voteButtons[0]!);
    expect(onVote).toHaveBeenCalledWith("opt-1");
  });

  it("displays live percentage results when participant has voted", () => {
    const votedPoll: Poll = {
      ...samplePoll,
      votedOptionId: "opt-1",
    };

    render(
      <ActivePollOverlay
        poll={votedPoll}
        isOrganizer={false}
        onVote={vi.fn()}
        onEndPoll={vi.fn()}
        onRecordPoll={vi.fn()}
        onDismissPoll={vi.fn()}
        isConnected={true}
      />
    );

    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/Your Vote/i)).toBeInTheDocument();
  });

  it("provides organizer controls to End, Record, and Dismiss poll", async () => {
    const user = userEvent.setup();
    const onEndPoll = vi.fn();
    const onRecordPoll = vi.fn();
    const onDismissPoll = vi.fn();

    render(
      <ActivePollOverlay
        poll={samplePoll}
        isOrganizer={true}
        onVote={vi.fn()}
        onEndPoll={onEndPoll}
        onRecordPoll={onRecordPoll}
        onDismissPoll={onDismissPoll}
        isConnected={true}
      />
    );

    const endBtn = screen.getByRole("button", { name: /End Poll/i });
    await user.click(endBtn);
    expect(onEndPoll).toHaveBeenCalled();

    const recordBtn = screen.getByRole("button", { name: /Record Result/i });
    await user.click(recordBtn);
    expect(onRecordPoll).toHaveBeenCalled();

    const dismissBtn = screen.getByRole("button", { name: /Close & Dismiss/i });
    await user.click(dismissBtn);
    expect(onDismissPoll).toHaveBeenCalled();
  });

  it("shows Recorded badge when poll is already recorded", () => {
    const recordedPoll: Poll = {
      ...samplePoll,
      isRecorded: true,
      recordedAt: Date.now(),
    };

    render(
      <ActivePollOverlay
        poll={recordedPoll}
        isOrganizer={true}
        onVote={vi.fn()}
        onEndPoll={vi.fn()}
        onRecordPoll={vi.fn()}
        onDismissPoll={vi.fn()}
        isConnected={true}
      />
    );

    expect(screen.getByText(/Recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record Result/i })).not.toBeInTheDocument();
  });
});

describe("RecordedPollsModal", () => {
  it("shows empty state when no polls recorded", () => {
    render(<RecordedPollsModal isOpen={true} onClose={vi.fn()} polls={[]} />);
    expect(screen.getByText(/No polls recorded yet/i)).toBeInTheDocument();
  });

  it("renders list of recorded polls with breakdowns", () => {
    const polls: Poll[] = [
      {
        id: "poll-1",
        sessionId: "sess-1",
        question: "How was question 1?",
        status: "ENDED",
        isRecorded: true,
        totalVotes: 15,
        createdAt: Date.now(),
        recordedAt: Date.now(),
        questionIndex: 0,
        options: [
          { id: "o1", text: "Easy", order: 0, voteCount: 10, percentage: 67 },
          { id: "o2", text: "Hard", order: 1, voteCount: 5, percentage: 33 },
        ],
      },
    ];

    render(<RecordedPollsModal isOpen={true} onClose={vi.fn()} polls={polls} />);
    expect(screen.getByText("How was question 1?")).toBeInTheDocument();
    expect(screen.getByText("15 votes")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("Q#1")).toBeInTheDocument();
  });
});
