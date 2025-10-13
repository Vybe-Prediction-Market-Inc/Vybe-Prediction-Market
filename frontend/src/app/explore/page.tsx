'use client';

import { useState } from "react";
import SearchBar from "@/components/SearchBar";

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    console.log("Searching for:", query);
  };

  return (
    <div className="mx-auto max-w-6xl p-8 space-y-6">
      <h1 className="h1 mb-4">Explore Events</h1>
      <SearchBar
        placeholder="Search for artists, tracks, or markets..."
        onSearch={handleSearch}
      />

      {searchQuery ? (
        <p className="muted mt-4">
          Showing results for:{" "}
          <span className="text-[var(--brandAccent)]">{searchQuery}</span>
        </p>
      ) : (
        <p className="muted mt-4">Browse trending prediction markets below.</p>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((event) => (
          <div key={event} className="card hover:border-[var(--brand)] transition">
            <div className="card-body">
              <h2 className="h2 mb-2">
                Will Morgan Wallen break streaming records this month? {event}
              </h2>
              <p className="muted text-sm mb-4">
                Predict the hottest music moments of the year.
              </p>
              <button className="btn btn-primary rounded-full">
                View Event
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
