import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, TrendingUp, TrendingDown, Minus, Search, SlidersHorizontal, Layers, RefreshCw } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ReviewCard from './ReviewCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function SentimentDashboard({ data, onClose, reviewLimit, onReAnalyze }) {
  const { place_info, reviews, summary, pagination } = data;
  const overlayRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [aspectFilter, setAspectFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const sentimentEmoji = {
    positive: '😊',
    negative: '😠',
    neutral: '😐',
  };

  const overallEmoji = sentimentEmoji[summary.overall_label] || '📊';

  const sentimentBarData = {
    labels: ['Positive', 'Negative', 'Neutral'],
    datasets: [
      {
        label: 'Reviews',
        data: [
          summary.positive_count,
          summary.negative_count,
          summary.neutral_count,
        ],
        backgroundColor: [
          'rgba(0, 184, 148, 0.85)',
          'rgba(225, 112, 85, 0.85)',
          'rgba(253, 203, 110, 0.85)',
        ],
        borderColor: [
          'rgba(0, 184, 148, 1)',
          'rgba(225, 112, 85, 1)',
          'rgba(253, 203, 110, 1)',
        ],
        borderWidth: 1,
        borderRadius: 10,
        barThickness: 34,
      },
    ],
  };

  const sentimentBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 15, 35, 0.9)',
        titleColor: '#f0f0f8',
        bodyColor: 'rgba(240, 240, 248, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(240, 240, 248, 0.7)',
          font: { family: 'Inter', size: 12, weight: 600 },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: 'rgba(240, 240, 248, 0.55)',
          font: { family: 'Inter', size: 12 },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
      },
    },
  };

  const normalizeScore = (score) => ((score + 1) / 2) * 100;

  const availableAspects = Object.keys(summary.aspect_sentiments || {});

  const filteredReviews = reviews
    .filter((r) => {
      if (sentimentFilter !== 'all' && r.sentiment.label !== sentimentFilter) return false;
      if (aspectFilter !== 'all' && (!r.aspects || !r.aspects.includes(aspectFilter))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = (r.text || '').toLowerCase();
        const matchAuthor = (r.author || '').toLowerCase();
        return matchText.includes(q) || matchAuthor.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating_high') return b.rating - a.rating;
      if (sortBy === 'rating_low') return a.rating - b.rating;
      if (sortBy === 'most_positive') return b.sentiment.positive - a.sentiment.positive;
      if (sortBy === 'most_negative') return b.sentiment.negative - a.sentiment.negative;
      return 0;
    });

  return (
    <AnimatePresence>
      <motion.div
        className="dashboard-overlay"
        ref={overlayRef}
        onClick={handleOverlayClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="dashboard"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <button className="dashboard-close" onClick={onClose} id="dashboard-close-btn">
            <X size={20} />
          </button>

          <button className="back-btn" onClick={onClose}>
            <ArrowLeft size={16} /> Back to results
          </button>

          <div className="dashboard-header">
            <h2>{place_info.name || 'Sentiment Analysis'}</h2>
            <p>
              {place_info.address}
              {place_info.rating > 0 && ` · ★ ${place_info.rating}`}
              {place_info.total_reviews > 0 && ` · ${place_info.total_reviews} total reviews`}
            </p>
          </div>


          <motion.div
            className="glass-card overall-sentiment"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <div className="sentiment-emoji">{overallEmoji}</div>
            <div className={`sentiment-score-display ${summary.overall_label}`}>
              {summary.average_compound > 0 ? '+' : ''}
              {summary.average_compound.toFixed(2)}
            </div>
            <div className="sentiment-overall-label">
              Overall {summary.overall_label} sentiment across {summary.total_reviews} reviews
            </div>
          </motion.div>

          <motion.div
            className="stats-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="glass-card stat-card">
              <div className="stat-value overall">{summary.total_reviews}</div>
              <div className="stat-label">Reviews Analyzed</div>
            </div>
            <div className="glass-card stat-card">
              <div className="stat-value positive">
                <TrendingUp size={24} style={{ display: 'inline', marginRight: 8 }} />
                {summary.positive_percent}%
              </div>
              <div className="stat-label">Positive ({summary.positive_count})</div>
            </div>
            <div className="glass-card stat-card">
              <div className="stat-value negative">
                <TrendingDown size={24} style={{ display: 'inline', marginRight: 8 }} />
                {summary.negative_percent}%
              </div>
              <div className="stat-label">Negative ({summary.negative_count})</div>
            </div>
            <div className="glass-card stat-card">
              <div className="stat-value neutral">
                <Minus size={24} style={{ display: 'inline', marginRight: 8 }} />
                {summary.neutral_percent}%
              </div>
              <div className="stat-label">Neutral ({summary.neutral_count})</div>
            </div>
          </motion.div>

          <motion.div
            className="charts-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="glass-card chart-card">
              <h3>Sentiment Distribution</h3>
              <div className="chart-container bar-chart-container">
                <Bar data={sentimentBarData} options={sentimentBarOptions} />
              </div>
            </div>

            <div className="glass-card chart-card">
              <h3>Aspect-Based Sentiment</h3>
              {Object.keys(summary.aspect_sentiments).length > 0 ? (
                <div className="aspect-list">
                  {Object.entries(summary.aspect_sentiments).map(([aspect, info]) => (
                    <div
                      key={aspect}
                      className={`aspect-item ${aspectFilter === aspect ? 'selected' : ''}`}
                      onClick={() => setAspectFilter(aspectFilter === aspect ? 'all' : aspect)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="aspect-header">
                        <span className="aspect-name">{aspect}</span>
                        <span className={`aspect-score ${info.label}`}>
                          {info.average_score > 0 ? '+' : ''}
                          {info.average_score.toFixed(2)}
                        </span>
                      </div>
                      <div className="aspect-bar-bg">
                        <div
                          className={`aspect-bar-fill ${info.label}`}
                          style={{ width: `${normalizeScore(info.average_score)}%` }}
                        />
                      </div>
                      <span className="aspect-mentions">
                        {info.mention_count} mention{info.mention_count !== 1 ? 's' : ''} (Click to filter)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No specific aspects detected in the reviews.
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            className="reviews-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="reviews-section-header">
              <h3>Individual Reviews ({filteredReviews.length} / {reviews.length})</h3>
            </div>

            <div className="reviews-toolbar">
              <div className="toolbar-search">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter reviews by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="toolbar-filters">
                <div className="filter-group">
                  <span className="filter-label">Sentiment:</span>
                  {['all', 'positive', 'negative', 'neutral'].map((st) => (
                    <button
                      key={st}
                      className={`filter-btn ${sentimentFilter === st ? 'active' : ''} ${st}`}
                      onClick={() => setSentimentFilter(st)}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>

                {availableAspects.length > 0 && (
                  <div className="filter-group">
                    <span className="filter-label">Aspect:</span>
                    <select
                      value={aspectFilter}
                      onChange={(e) => setAspectFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Aspects</option>
                      {availableAspects.map((asp) => (
                        <option key={asp} value={asp}>
                          {asp}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="filter-group">
                  <span className="filter-label">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="filter-select"
                  >
                    <option value="default">Default</option>
                    <option value="rating_high">Rating: High to Low</option>
                    <option value="rating_low">Rating: Low to High</option>
                    <option value="most_positive">Most Positive</option>
                    <option value="most_negative">Most Negative</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredReviews.length > 0 ? (
              <div className="reviews-list">
                {filteredReviews.map((review, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  >
                    <ReviewCard review={review} index={i} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="empty-reviews-state">
                <p>No reviews match your selected filters or search query.</p>
                <button
                  className="reset-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setSentimentFilter('all');
                    setAspectFilter('all');
                    setSortBy('default');
                  }}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

