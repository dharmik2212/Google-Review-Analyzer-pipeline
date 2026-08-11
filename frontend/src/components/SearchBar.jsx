import { useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ onSearch, isLoading }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-container">
      <div className="search-wrapper">
        <Search size={20} className="search-icon" />
        <input
          id="search-input"
          type="text"
          className="search-input"
          placeholder="Search any shop or business... e.g. 'best pizza in New York'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <button
          id="search-btn"
          type="submit"
          className="search-btn"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              Searching...
            </>
          ) : (
            <>
              <Search size={16} />
              Analyze
            </>
          )}
        </button>
      </div>
    </form>
  );
}
