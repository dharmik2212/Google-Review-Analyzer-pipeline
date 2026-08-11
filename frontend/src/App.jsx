import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from './components/SearchBar';
import PlaceCard from './components/PlaceCard';
import SentimentDashboard from './components/SentimentDashboard';
import { searchPlaces, getReviewsWithSentiment } from './api';
import './index.css';

export default function App() {
  const [places, setPlaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query) => {
    setIsSearching(true);
    setError('');
    setSearchQuery(query);
    setDashboardData(null);
    setHasSearched(true);

    try {
      const data = await searchPlaces(query);
      setPlaces(data.places || []);
    } catch (err) {
      setError(err.message);
      setPlaces([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaceClick = async (place) => {
    if (!place.data_id) {
      setError('No place info available for this business.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const result = await getReviewsWithSentiment(place.data_id, 50);
      setDashboardData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const closeDashboard = () => {
    setDashboardData(null);
  };

  return (
    <>
      <div className="app-bg" />

      <header className="hero">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Google Review Analyzer
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </motion.div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            className="dashboard-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ cursor: 'wait' }}
          >
            <div className="loading-state" style={{ marginTop: '20vh' }}>
              <div className="loading-pulse" />
              <p className="loading-text">
                Fetching 50 latest reviews & analyzing sentiment...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {hasSearched && !isSearching && (
        <section className="results-section" id="results-section">
          <div className="results-header">
            <h2>
              {places.length > 0
                ? `Results for "${searchQuery}"`
                : `No results for "${searchQuery}"`}
            </h2>
            {places.length > 0 && (
              <span className="results-count">{places.length} found</span>
            )}
          </div>

          {places.length > 0 ? (
            <div className="results-grid">
              {places.map((place, i) => (
                <PlaceCard
                  key={place.data_id || i}
                  place={place}
                  onClick={handlePlaceClick}
                  index={i}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p>No businesses found. Try a different search term.</p>
            </div>
          )}
        </section>
      )}

      {isSearching && (
        <div className="loading-state">
          <div className="loading-pulse" />
          <p className="loading-text">Searching Google Maps...</p>
        </div>
      )}

      <AnimatePresence>
        {dashboardData && (
          <SentimentDashboard
            data={dashboardData}
            onClose={closeDashboard}
          />
        )}
      </AnimatePresence>
    </>
  );
}
