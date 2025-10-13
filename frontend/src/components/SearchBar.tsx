'use client';

import { useState } from "react";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export default function SearchBar({ placeholder = "Search...", onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl flex items-center bg-[#191414] border border-[#1ED760] rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-[#1DB954] transition"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none"
      />
      <button
        type="submit"
        className="ml-2 px-4 py-1 bg-[#1DB954] hover:bg-[#1ED760] text-black font-semibold rounded-full transition"
      >
        Search
      </button>
    </form>
  );
}
