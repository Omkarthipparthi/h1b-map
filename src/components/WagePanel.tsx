'use client';

interface WageData {
    area: number;
    areaName: string;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
}

interface WagePanelProps {
    wageData: WageData | null;
    salary: number;
    onSalaryChange: (salary: number) => void;
}

function formatCurrency(hourly: number, mode: 'hourly' | 'annual' = 'hourly'): string {
    const amount = mode === 'annual' ? hourly * 2080 : hourly;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(amount);
}

function getLotteryPicks(level: number): { picks: number; label: string; color: string } {
    switch (level) {
        case 4:
            return { picks: 4, label: 'Excellent Odds', color: 'from-green-500 to-emerald-500' };
        case 3:
            return { picks: 3, label: 'Good Odds', color: 'from-blue-500 to-cyan-500' };
        case 2:
            return { picks: 2, label: 'Moderate Odds', color: 'from-yellow-500 to-orange-500' };
        default:
            return { picks: 1, label: 'Standard Odds', color: 'from-red-500 to-pink-500' };
    }
}

function calculateWageLevel(salary: number, wageData: WageData): number {
    const annualSalary = salary;
    const l1 = wageData.level1 * 2080;
    const l2 = wageData.level2 * 2080;
    const l3 = wageData.level3 * 2080;
    const l4 = wageData.level4 * 2080;

    if (annualSalary >= l4) return 4;
    if (annualSalary >= l3) return 3;
    if (annualSalary >= l2) return 2;
    return 1;
}

export default function WagePanel({ wageData, salary, onSalaryChange }: WagePanelProps) {
    if (!wageData) {
        return (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Wage Levels</h2>
                <p className="text-slate-400">Select a job and click on a county to view wage data.</p>
            </div>
        );
    }

    const wageLevel = calculateWageLevel(salary, wageData);
    const lotteryInfo = getLotteryPicks(wageLevel);

    const levels = [
        { num: 1, hourly: wageData.level1, label: 'Level I' },
        { num: 2, hourly: wageData.level2, label: 'Level II' },
        { num: 3, hourly: wageData.level3, label: 'Level III' },
        { num: 4, hourly: wageData.level4, label: 'Level IV' },
    ];

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 space-y-6">
            {/* Area name */}
            <div>
                <h2 className="text-xl font-semibold text-white">{wageData.areaName}</h2>
                <p className="text-sm text-slate-400">Prevailing Wage Data 2025-2026</p>
            </div>

            {/* Wage levels */}
            <div className="space-y-3">
                {levels.map(({ num, hourly, label }) => (
                    <div
                        key={num}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${num === wageLevel
                                ? 'bg-blue-600/20 border border-blue-500/50 ring-2 ring-blue-500/30'
                                : 'bg-slate-700/30 border border-transparent'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${num === wageLevel ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                                    }`}
                            >
                                {num}
                            </span>
                            <span className={num === wageLevel ? 'text-white font-medium' : 'text-slate-300'}>
                                {label}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className={`font-mono ${num === wageLevel ? 'text-white' : 'text-slate-300'}`}>
                                {formatCurrency(hourly)}/hr
                            </p>
                            <p className="text-xs text-slate-500">{formatCurrency(hourly, 'annual')}/yr</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Salary input */}
            <div className="space-y-2">
                <label className="text-sm text-slate-400">Your Annual Salary</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                        type="number"
                        value={salary || ''}
                        onChange={(e) => onSalaryChange(Number(e.target.value))}
                        placeholder="Enter salary"
                        className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Lottery odds display */}
            {salary > 0 && (
                <div className={`p-4 rounded-xl bg-gradient-to-r ${lotteryInfo.color} bg-opacity-20`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white font-semibold">{lotteryInfo.label}</p>
                            <p className="text-white/80 text-sm">Wage Level {wageLevel}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-white">{lotteryInfo.picks}x</p>
                            <p className="text-white/80 text-xs">Lottery Picks</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
