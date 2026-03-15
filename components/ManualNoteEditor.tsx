"use client";

import { useState } from "react";
import { Save } from "lucide-react";

interface Note {
  outsideProgressNote: string | null;
  nextStepNote: string | null;
}

interface Props {
  projectId: string;
  initialNote?: Note;
  onSaved?: () => void;
}

export default function ManualNoteEditor({ projectId, initialNote, onSaved }: Props) {
  const [outside, setOutside] = useState(initialNote?.outsideProgressNote ?? "");
  const [nextStep, setNextStep] = useState(initialNote?.nextStepNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/notes/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outsideProgressNote: outside || null,
          nextStepNote: nextStep || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Outside GitHub progress
        </label>
        <textarea
          value={outside}
          onChange={(e) => setOutside(e.target.value)}
          placeholder="Work not visible in the repo (writing, meetings, reading…)"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Next step
        </label>
        <textarea
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="What's the immediate next thing to do?"
          rows={2}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
      >
        <Save size={13} />
        {saved ? "Saved!" : saving ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}
