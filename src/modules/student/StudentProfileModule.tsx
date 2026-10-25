import React, { useState } from 'react';
import { StudentProfile, AcademicLevel, TimeAvailability, BudgetConstraint } from '../../types/domain';
import { INITIAL_STUDENT_PROFILES } from '../../data/sampleProfiles';
import { GraduationCap, Clock, DollarSign, Wrench, Heart, Save, Check } from 'lucide-react';

interface StudentProfileModuleProps {
  currentStudent: StudentProfile;
  onUpdateStudent: (student: StudentProfile) => void;
  onProceedToGenerate: () => void;
}

export const StudentProfileModule: React.FC<StudentProfileModuleProps> = ({
  currentStudent,
  onUpdateStudent,
  onProceedToGenerate,
}) => {
  const [profile, setProfile] = useState<StudentProfile>(currentStudent);
  const [skillInput, setSkillInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  const handlePresetSelect = (preset: StudentProfile) => {
    setProfile(preset);
    onUpdateStudent(preset);
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!profile.existingSkills.includes(skillInput.trim())) {
        const updated = {
          ...profile,
          existingSkills: [...profile.existingSkills, skillInput.trim()],
          updatedAt: new Date().toISOString(),
        };
        setProfile(updated);
        onUpdateStudent(updated);
      }
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    const updated = {
      ...profile,
      existingSkills: profile.existingSkills.filter(s => s !== skill),
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    onUpdateStudent(updated);
  };

  const handleAddInterest = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && interestInput.trim()) {
      e.preventDefault();
      if (!profile.primaryInterests.includes(interestInput.trim())) {
        const updated = {
          ...profile,
          primaryInterests: [...profile.primaryInterests, interestInput.trim()],
          updatedAt: new Date().toISOString(),
        };
        setProfile(updated);
        onUpdateStudent(updated);
      }
      setInterestInput('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    const updated = {
      ...profile,
      primaryInterests: profile.primaryInterests.filter(i => i !== interest),
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    onUpdateStudent(updated);
  };

  const handleSave = () => {
    onUpdateStudent(profile);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Module Title & Archetype Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#303A34] gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F5] flex items-center space-x-2.5">
            <GraduationCap className="w-5 h-5 text-[#10B981]" />
            <span>Module 1: Student Intelligence Profile</span>
          </h2>
          <p className="text-xs text-[#A5B0A8] mt-1">
            Configure academic background, verified skills, primary interests, available hours, and financial parameters.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-[#A5B0A8]">Load Profile:</span>
          {INITIAL_STUDENT_PROFILES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`text-xs px-3 py-1 rounded-md border transition-colors cursor-pointer ${
                profile.id === preset.id
                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981] font-semibold'
                  : 'bg-[#1C2420] text-[#A5B0A8] border-[#303A34] hover:text-[#F5F7F5]'
              }`}
            >
              {preset.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {isSavedAlert && (
        <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981] text-xs rounded-lg flex items-center space-x-2">
          <Check className="w-4 h-4 text-[#10B981]" />
          <span>Student profile saved to state and local storage.</span>
        </div>
      )}

      {/* Profile Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Details */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
          <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#10B981]" />
            <span>Academic Background</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Student Full Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Academic Level</label>
              <select
                value={profile.academicLevel}
                onChange={(e) => setProfile({ ...profile, academicLevel: e.target.value as AcademicLevel })}
                className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
              >
                <option>Undergraduate</option>
                <option>Postgraduate</option>
                <option>High School</option>
                <option>Self-Taught</option>
                <option>PhD/Researcher</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Target Weeks</label>
              <input
                type="number"
                min="2"
                max="52"
                value={profile.targetDeadlineWeeks}
                onChange={(e) => setProfile({ ...profile, targetDeadlineWeeks: parseInt(e.target.value) || 12 })}
                className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Major / Degree Track</label>
            <input
              type="text"
              value={profile.major}
              onChange={(e) => setProfile({ ...profile, major: e.target.value })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Target Career Goal</label>
            <input
              type="text"
              value={profile.careerGoal}
              onChange={(e) => setProfile({ ...profile, careerGoal: e.target.value })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>

        {/* Constraints & Environment */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-4">
          <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#10B981]" />
            <span>Time & Resource Constraints</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Time Availability</label>
            <select
              value={profile.timeAvailability}
              onChange={(e) => setProfile({ ...profile, timeAvailability: e.target.value as TimeAvailability })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            >
              <option>Part-Time (&lt; 10 hrs/wk)</option>
              <option>Standard (10-20 hrs/wk)</option>
              <option>Intensive (20-40 hrs/wk)</option>
              <option>Full-Time Bootcamp</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Budget Constraint</label>
            <select
              value={profile.budgetConstraint}
              onChange={(e) => setProfile({ ...profile, budgetConstraint: e.target.value as BudgetConstraint })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            >
              <option>Zero Budget ($0 - Free Tier Only)</option>
              <option>Low (&lt; $50 for hosting/APIs)</option>
              <option>Moderate ($50 - $200)</option>
              <option>Funded/Lab ($200+)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Hardware / Lab Infrastructure</label>
            <input
              type="text"
              value={profile.targetHardware || ''}
              onChange={(e) => setProfile({ ...profile, targetHardware: e.target.value })}
              placeholder="e.g. Standard Laptop, Raspberry Pi, GPU Cluster"
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A5B0A8] mb-1">Preferred Project Domain</label>
            <input
              type="text"
              value={profile.preferredDomain || ''}
              onChange={(e) => setProfile({ ...profile, preferredDomain: e.target.value })}
              className="w-full bg-[#101713] border border-[#303A34] rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>
      </div>

      {/* Skills & Interests Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verified Skills */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-[#10B981]" />
              <span>Current Verified Skills ({profile.existingSkills.length})</span>
            </label>
            <span className="text-[11px] text-[#A5B0A8]">Press Enter to add</span>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2 bg-[#101713] border border-[#303A34] rounded-lg">
            {profile.existingSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono bg-[#1C2420] text-[#10B981] border border-[#303A34]"
              >
                <span>{skill}</span>
                <button
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-white text-[#A5B0A8] ml-1 font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="+ add skill (e.g. Docker, PyTorch)"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleAddSkill}
              className="bg-transparent text-xs text-[#F5F7F5] placeholder-[#A5B0A8]/60 focus:outline-none px-2 py-1 flex-1 min-w-[120px]"
            />
          </div>
        </div>

        {/* Primary Interests */}
        <div className="bg-[#1C2420] p-5 rounded-xl border border-[#303A34] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#F5F7F5] flex items-center space-x-2">
              <Heart className="w-4 h-4 text-[#10B981]" />
              <span>Domain Passions & Topics ({profile.primaryInterests.length})</span>
            </label>
            <span className="text-[11px] text-[#A5B0A8]">Press Enter to add</span>
          </div>

          <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2 bg-[#101713] border border-[#303A34] rounded-lg">
            {profile.primaryInterests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-[#1C2420] text-[#F5F7F5] border border-[#303A34]"
              >
                <span>{interest}</span>
                <button
                  onClick={() => handleRemoveInterest(interest)}
                  className="hover:text-white text-[#A5B0A8] ml-1 font-bold cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="+ add topic (e.g. Edge Audio, ZKP)"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={handleAddInterest}
              className="bg-transparent text-xs text-[#F5F7F5] placeholder-[#A5B0A8]/60 focus:outline-none px-2 py-1 flex-1 min-w-[120px]"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#303A34]">
        <button
          onClick={handleSave}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#1C2420] hover:bg-[#242E28] text-[#F5F7F5] text-xs font-medium border border-[#303A34] transition-colors cursor-pointer"
        >
          <Save className="w-4 h-4 text-[#10B981]" />
          <span>Save Profile Changes</span>
        </button>

        <button
          onClick={onProceedToGenerate}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#101713] text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Generate Personalized Projects →</span>
        </button>
      </div>
    </div>
  );
};
