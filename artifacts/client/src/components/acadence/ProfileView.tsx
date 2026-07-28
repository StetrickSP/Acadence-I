import { useState } from 'react';
import { Edit3, Settings, X } from 'lucide-react';
import { useAcadence } from '@/context/AcadenceContext';
import { getGlobalStats } from '@/lib/acadence-utils';

export function ProfileView() {
  const { courseData, attendanceState, profileData, settingsData, updateProfile, updateSettings } = useAcadence();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editSettingsOpen, setEditSettingsOpen] = useState(false);

  // Form state
  const [profileForm, setProfileForm] = useState({ name: '', office: '', subject: '' });
  const [settingsForm, setSettingsForm] = useState({ email: '', password: '' });

  const stats = getGlobalStats(courseData, attendanceState);

  const openEditProfile = () => {
    setProfileForm({ name: profileData.name, office: profileData.office, subject: profileData.subject });
    setEditProfileOpen(true);
  };

  const openEditSettings = () => {
    setSettingsForm({ email: settingsData.email, password: '' });
    setEditSettingsOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = profileForm.name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    updateProfile({ name: profileForm.name, office: profileForm.office, subject: profileForm.subject, avatarInitials: initials });
    setEditProfileOpen(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ email: settingsForm.email, ...(settingsForm.password ? { password: settingsForm.password } : {}) });
    setEditSettingsOpen(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateProfile({ avatarImg: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section aria-labelledby="profile-title" className="view-in">
      <header className="mb-6">
        <span
          className="inline-block px-3 py-1 rounded-full mb-3 font-bold text-[11px] tracking-widest uppercase"
          style={{ background: 'rgb(204,251,241)', color: 'rgb(15,118,110)' }}
        >
          INSTRUCTOR ACCOUNT
        </span>
        <h1 id="profile-title" className="heading-font text-slate-900 font-bold" style={{ fontSize: 31 }}>
          Profile
        </h1>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed">
          Your teaching identity and faculty assignment summary.
        </p>
      </header>

      {/* Profile Card */}
      <article className="canva-card rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden">
              {profileData.avatarImg ? (
                <img src={profileData.avatarImg} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profileData.avatarInitials
              )}
            </div>
            <div>
              <h2 className="heading-font text-slate-900 font-bold" style={{ fontSize: 27 }}>
                {profileData.name}
              </h2>
              <p className="text-slate-500 mt-1 text-sm">Senior Lecturer · Computer Science Department</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span
                  className="px-3 py-1.5 rounded-lg font-semibold text-xs"
                  style={{ background: 'rgb(204,251,241)', color: 'rgb(15,118,110)' }}
                >
                  {profileData.subject}
                </span>
                <span className="px-3 py-1.5 rounded-lg font-semibold text-xs bg-slate-100 text-slate-600">
                  Main Campus
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openEditProfile}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all self-start sm:self-center shadow-sm"
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-7 pt-6 border-t border-slate-200">
          <div>
            <p className="text-sm text-slate-500">Assigned courses</p>
            <p className="text-xl font-bold mt-1">{stats.totalCourses}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Students</p>
            <p className="text-xl font-bold mt-1">{stats.totalStudents}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Office</p>
            <p className="text-xl font-bold mt-1">{profileData.office}</p>
          </div>
        </div>
      </article>

      {/* Account Settings Card */}
      <article className="canva-card rounded-3xl border border-slate-200 bg-white p-6 md:p-8 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h2 className="heading-font text-xl font-bold text-slate-900">Account Settings</h2>
            <p className="text-slate-500 text-sm mt-1">Manage your login email and security password</p>
          </div>
          <button
            type="button"
            onClick={openEditSettings}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all self-start sm:self-center shadow-sm"
          >
            <Settings className="w-4 h-4" /> Update Settings
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Registered Email</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{settingsData.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Security Password</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">••••••••</p>
          </div>
        </div>
      </article>

      {/* Edit Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-teal-700" /> Edit Profile
              </h3>
              <button type="button" onClick={() => setEditProfileOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Name</label>
                <input
                  type="text" required
                  value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white"
                  placeholder="e.g., Dr. Nguyen Minh Tuan"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Avatar Image (PNG/JPG)</label>
                <input
                  type="file" accept=".png,.jpg,.jpeg"
                  onChange={handleAvatarChange}
                  className="w-full text-sm border border-slate-200 rounded-xl p-2.5 bg-slate-50 text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Office Room</label>
                <input
                  type="text" required
                  value={profileForm.office} onChange={(e) => setProfileForm({ ...profileForm, office: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white"
                  placeholder="e.g., B-204"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Subject / Department</label>
                <input
                  type="text" required
                  value={profileForm.subject} onChange={(e) => setProfileForm({ ...profileForm, subject: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white"
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditProfileOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 transition-colors shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Settings Modal */}
      {editSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-700" /> Account Settings
              </h3>
              <button type="button" onClick={() => setEditSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                <input
                  type="email" required
                  value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white"
                  placeholder="e.g., admin@university.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">New Password</label>
                <input
                  type="password"
                  value={settingsForm.password} onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-teal-600 bg-slate-50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditSettingsOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-700 text-white font-semibold text-sm hover:bg-teal-800 transition-colors shadow-sm">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
