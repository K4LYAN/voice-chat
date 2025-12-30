export const LANGUAGE_DATA = [
    { code: 'English', name: 'English', native: 'English', loc: 'en' },
    { code: 'Spanish', name: 'Spanish', native: 'Español', loc: 'es' },
    { code: 'Hindi', name: 'Hindi', native: 'हिन्दी', loc: 'hi' },
    { code: 'Bengali', name: 'Bengali', native: 'বাংলা', loc: 'bn' },
    { code: 'Marathi', name: 'Marathi', native: 'मराठी', loc: 'mr' },
    { code: 'Telugu', name: 'Telugu', native: 'తెలుగు', loc: 'te' },
    { code: 'Tamil', name: 'Tamil', native: 'தமிழ்', loc: 'ta' },
    { code: 'Gujarati', name: 'Gujarati', native: 'ગુજરાતી', loc: 'gu' },
    { code: 'Kannada', name: 'Kannada', native: 'ಕನ್ನಡ', loc: 'kn' },
    { code: 'Malayalam', name: 'Malayalam', native: 'മലയാളം', loc: 'ml' },
    { code: 'Punjabi', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', loc: 'pa' },
    { code: 'Odia', name: 'Odia', native: 'ଓଡ଼ିଆ', loc: 'or' },
    { code: 'Assamese', name: 'Assamese', native: 'অসমীয়া', loc: 'as' },
    { code: 'Urdu', name: 'Urdu', native: 'اردو', loc: 'ur' },
    { code: 'French', name: 'French', native: 'Français', loc: 'fr' },
    { code: 'German', name: 'German', native: 'Deutsch', loc: 'de' },
    { code: 'Portuguese', name: 'Portuguese', native: 'Português', loc: 'pt' },
    { code: 'Russian', name: 'Russian', native: 'Русский', loc: 'ru' },
    { code: 'Japanese', name: 'Japanese', native: '日本語', loc: 'ja' },
    { code: 'Chinese', name: 'Chinese', native: '中文', loc: 'zh' },
    { code: 'Arabic', name: 'Arabic', native: 'العربية', loc: 'ar' },
    { code: 'Indonesian', name: 'Indonesian', native: 'Bahasa', loc: 'id' },
];

export const INTERESTS = [
    { id: 'sports', label: 'Sports', icon: '⚽' },
    { id: 'tech', label: 'Tech', icon: '💻' },
    { id: 'movies', label: 'Movies', icon: '🎬' },
    { id: 'gaming', label: 'Gaming', icon: '🎮' },
    { id: 'music', label: 'Music', icon: '🎵' },
    { id: 'art', label: 'Art', icon: '🎨' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'food', label: 'Food', icon: '🍕' },
];

// Socket.io connection setup
export const getSocketUrl = () => {
    if (process.env.SERVER_URL) return process.env.SERVER_URL;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return 'https://voice-chat-0dnh.onrender.com';
};
