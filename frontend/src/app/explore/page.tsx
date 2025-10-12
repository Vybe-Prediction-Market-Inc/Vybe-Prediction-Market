'use client';

import { useState } from "react";
import SearchBar from "@/components/SearchBar";

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("Searching for:", query);
    // TODO: Hook this up to backend or filter events list
  };

  return (
    <div className="p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold mb-4">Explore Events</h1>
      <SearchBar placeholder="Search for artists, tracks, or markets..." onSearch={handleSearch} />

      {searchQuery ? (
        <p className="text-gray-300 mt-4">Showing results for: <span className="text-[#1ED760]">{searchQuery}</span></p>
      ) : (
        <p className="text-gray-400 mt-4">Browse trending prediction markets below.</p>
      )}

      {/* TODO: Replace this with dynamic events */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((event) => (
          <div
            key={event}
            className="bg-[#191414] border border-[#1DB954]/20 rounded-lg p-4 hover:border-[#1DB954] transition"
          >
            <h2 className="text-xl font-semibold mb-2">Sample Event {event}</h2>
            <p className="text-sm text-gray-400 mb-4">Description of the event goes here.</p>
            <button className="px-4 py-2 bg-[#1DB954] hover:bg-[#1ED760] text-black rounded-full font-medium transition">
              View Event
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
