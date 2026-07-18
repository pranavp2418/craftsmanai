const fs = require('fs');
const path = 'components/workspace/ManufacturerHandoffPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { SPECIALTIES }')) {
  // Insert imports
  content = content.replace(
    import { RequestData } from '@/lib/requestsData';,
    import { RequestData } from '@/lib/requestsData';\nimport { SPECIALTIES } from '@/lib/manufacturersData';\nimport CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
  );
}

content = content.replace(
  /interface NewMfgForm \{[\s\S]*?\}/,
  interface NewMfgForm {\n  name: string;\n  emails: { label: string; value: string }[];\n  phone: string;\n  location: string;\n  specialty: string;\n}
);

// We need to find SendToManufacturerModal definition to add states
const modalStart = 'function SendToManufacturerModal(';
if (!content.includes('const [showSpecialtyDropdown, setShowSpecialtyDropdown]')) {
  content = content.replace(
    /const \[search, setSearch\] = useState\(''\);/,
    const [search, setSearch] = useState('');\n  const [showSpecialtyDropdown, setShowSpecialtyDropdown] = useState(false);\n  const [selectedSpecialty, setSelectedSpecialty] = useState(SPECIALTIES[0]);\n  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  );
  
  content = content.replace(
    /const \[newMfg, setNewMfg\] = useState<NewMfgForm>\(\{\s*name: '',\s*emails: \[\{\s*label: '',\s*value: ''\s*\}\],\s*phone: '',\s*location: ''\s*\}\);/g,
    const [newMfg, setNewMfg] = useState<NewMfgForm>({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '', specialty: SPECIALTIES[0].label });
  );
}

// In handleAddAndSelect, we need to pass specialty
content = content.replace(
  /const newEntry = \{\s*id: \custom-\$\{Date\.now\(\)\}\,\s*name: newMfg\.name\.trim\(\),[\s\S]*?\};\s*onAddManufacturer\(newEntry\);/,
  const newEntry: typeof MANUFACTURERS[0] = {
        id: \custom-\$\{Date.now()\}\,
        name: newMfg.name.trim(),
        initials,
        avatarColor: '#BFDBFE',
        specialty: selectedSpecialty.label,
        location: newMfg.location.trim() || 'Online',
        verified: false,
        status: 'Available',
        avgResponseTime: '—',
        totalRequests: 0,
        completedRequests: 0,
        emails: validEmails,
        //phone: phoneCountryCode + newMfg.phone
      };
      onAddManufacturer(newEntry);
);

// Resetting the form
content = content.replace(
  /setNewMfg\(\{ name: '', emails: \[\{ label: '', value: '' \}\], phone: '', location: '' \}\);/,
  setNewMfg({ name: '', emails: [{ label: 'Work', value: '' }], phone: '', location: '', specialty: SPECIALTIES[0].label });\n      setSelectedSpecialty(SPECIALTIES[0]);\n      setPhoneCountryCode('+1');
);

const formReplacement = \{showAddForm && (
          <div className="mt-3 bg-white border border-hairline rounded-sheet-lg p-5 sm:p-6 shadow-modal-light">
              <div className="flex flex-col gap-4 sm:gap-3">
                <div>
                  <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Manufacturer Name <span className="text-[#EF4444]">*</span></label>
                  <input aria-label="e.g. ArtisanGold Co."
                    type="text"
                    placeholder="e.g. ArtisanGold Co."
                    value={newMfg.name}
                    onChange={(e) => { setNewMfg({ ...newMfg, name: e.target.value }); setAddError(false); }}
                    className={\w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border \\}/>
                  {addError && !newMfg.name.trim() && <p className="text-[11px] text-[#EF4444] mt-0.5">Name is required</p>}
                </div>

                <div>
                  <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Specialty</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSpecialtyDropdown((prev) => !prev)}
                      className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 flex items-center justify-between cursor-pointer bg-surface-100 font-inter border border-hairline">
                      <span className={\px-2.5 py-0.5 rounded-full text-label-xs font-semibold \ \\}>
                        {selectedSpecialty.label}
                      </span>
                      <i className={\
i-arrow-down-s-line text-body-md text-ink-400 transition-transform \\} />
                    </button>
                    {showSpecialtyDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 rounded-card-lg p-1.5 z-10 bg-white shadow-pop-md border border-hairline max-h-[200px] overflow-y-auto">
                        {SPECIALTIES.map((spec) => (
                          <button
                            type="button"
                            key={spec.label}
                            onClick={() => { setSelectedSpecialty(spec); setNewMfg({ ...newMfg, specialty: spec.label }); setShowSpecialtyDropdown(false); }}
                            className={\w-full text-left px-3 min-h-touch sm:min-h-0 sm:py-2 rounded text-[16px] sm:text-label font-medium flex items-center gap-2 cursor-pointer hover:bg-surface-200 transition-colors \\}
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-current" />
                            <span>{spec.label}</span>
                            {selectedSpecialty.label === spec.label && (
                              <i className="ri-check-line text-label ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Email Addresses</label>
                  <div className="flex flex-col gap-2">
                    {newMfg.emails.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input aria-label="Label"
                          type="text"
                          placeholder="Label"
                          value={entry.label}
                          onChange={(e) => {
                            const next = [...newMfg.emails];
                            next[idx].label = e.target.value;
                            setNewMfg({ ...newMfg, emails: next });
                          }}
                          className="w-[90px] sm:w-[100px] px-2 sm:px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline"/>
                        <input aria-label="Email address"
                          type="email"
                          placeholder="Email address"
                          value={entry.value}
                          onChange={(e) => {
                            const next = [...newMfg.emails];
                            next[idx].value = e.target.value;
                            setNewMfg({ ...newMfg, emails: next });
                          }}
                          className="flex-1 min-w-0 px-3 min-h-touch sm:min-h-0 sm:py-2 rounded-card text-[16px] sm:text-label text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline"/>
                        {newMfg.emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewMfg({ ...newMfg, emails: newMfg.emails.filter((_, i) => i !== idx) })}
                            className="touch-target rounded-full hover:bg-surface-200 flex-shrink-0"
                            aria-label="Remove email"
                          >
                            <i className="ri-close-line text-body-md text-ink-400" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewMfg({ ...newMfg, emails: [...newMfg.emails, { label: '', value: '' }] })}
                    className="mt-2 min-h-touch flex items-center gap-1.5 px-2 -ml-2 rounded-lg text-body-sm sm:text-label-xs font-medium text-brand cursor-pointer hover:bg-brand-light transition-colors"
                  >
                    <i className="ri-add-line text-body-sm" /> Add another email
                  </button>
                </div>

                <div>
                  <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">Contact Number</label>
                  <div className="flex gap-2 sm:gap-3">
                    <CountryCodeSelect
                      value={phoneCountryCode}
                      onChange={setPhoneCountryCode}
                      className="!bg-surface-100 !border-hairline rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 font-inter !px-3 !py-2.5"
                    />
                    <input aria-label="Contact Number"
                      type="tel"
                      inputMode="numeric"
                      placeholder="Contact Number"
                      value={newMfg.phone}
                      onChange={(e) => setNewMfg({ ...newMfg, phone: e.target.value.replace(/\\D/g, '') })}
                      className="flex-1 px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline min-w-0" />
                  </div>
                </div>

                <div>
                  <label className="text-label-xs font-semibold text-ink-400 mb-1.5 sm:mb-1 block">
                    Location <span className="normal-case font-normal text-stone-300">(optional)</span>
                  </label>
                  <input aria-label="e.g. Milan, Italy"
                    type="text"
                    placeholder="e.g. Milan, Italy"
                    value={newMfg.location}
                    onChange={(e) => setNewMfg({ ...newMfg, location: e.target.value })}
                    className="w-full px-3 min-h-touch sm:min-h-0 sm:py-2.5 rounded-card text-[16px] sm:text-body-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 bg-surface-100 border border-hairline"/>
                </div>

                  <button
                    type="button"
                    onClick={handleAddAndSelect}
                    className="w-full mt-6 sm:mt-5 min-h-touch sm:min-h-0 sm:py-3 rounded-card-lg text-[16px] sm:text-body-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity bg-gradient-brand-violet shadow-glow-brand-deep disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Add Manufacturer
                  </button>
              </div>
          </div>
        )}\;

// The old portion starts from \{showAddForm && (\ up to \<button\\s+type="button"\\s+onClick={handleAddAndSelect}[\\s\\S]*?</button>\\s*</div>\\s*</div>\\s*\)\}\
const oldFormRegex = /\{showAddForm && \([\s\S]*?<button\s+type="button"\s+onClick=\{handleAddAndSelect\}[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*\)\}/;

if(oldFormRegex.test(content)) {
  content = content.replace(oldFormRegex, formReplacement);
} else {
  console.log("Could not find the target old form to replace.");
}

fs.writeFileSync(path, content, 'utf8');
console.log('Update completed');
