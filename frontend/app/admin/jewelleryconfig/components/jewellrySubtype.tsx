import React from 'react';
import { Edit2, Ban, CheckCircle } from 'lucide-react';

export interface JewelrySubtype {
    id: string;
    name: string;
    status: 'active' | 'disabled';
    quizCount: number;
}

interface JewelrySubtypeTableProps {
    subtypes: JewelrySubtype[];
    onEdit: (subtype: JewelrySubtype) => void;
    onToggleStatus: (subtype: JewelrySubtype) => void;
}

const JewelrySubtypeTable: React.FC<JewelrySubtypeTableProps> = ({
    subtypes,
    onEdit,
    onToggleStatus
}) => {
    return (
        <div className="overflow-x-auto bg-white rounded-2xl">
            <table className="w-full">
                <thead className="bg-[#F1F1F1]">
                    <tr>
                        <th className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-left text-[10px] md:text-xs lg:text-xs font-bold text-[#6B7280] uppercase tracking-tight md:tracking-wide lg:tracking-wider rounded-tl-2xl leading-tight md:leading-snug lg:leading-normal">
                            Subtype Name
                        </th>
                        <th className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-left text-[10px] md:text-xs lg:text-xs font-bold text-[#6B7280] uppercase tracking-tight md:tracking-wide lg:tracking-wider leading-tight md:leading-snug lg:leading-normal">
                            Status
                        </th>
                        <th className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-left text-[10px] md:text-xs lg:text-xs font-bold text-[#6B7280] uppercase tracking-tight md:tracking-wide lg:tracking-wider leading-tight md:leading-snug lg:leading-normal">
                            Quiz count
                        </th>
                        <th className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-left text-[10px] md:text-xs lg:text-xs font-bold text-[#6B7280] uppercase tracking-tight md:tracking-wide lg:tracking-wider rounded-tr-2xl leading-tight md:leading-snug lg:leading-normal">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {subtypes.map((subtype, index) => (
                        <tr
                            key={subtype.id}
                            className={`border-b border-gray-100 last:border-0 ${index % 2 === 1 ? 'bg-[#F9F9F9]' : 'bg-white'}`}
                        >
                            <td className="px-2 md:px-3 lg:px-4 py-2 md:py-3 lg:py-4 whitespace-nowrap text-xs md:text-sm lg:text-sm font-medium text-[#1E1E1E] leading-tight md:leading-snug lg:leading-normal">
                                {subtype.name}
                            </td>
                            <td className="px-2 md:px-3 lg:px-4 py-2 md:py-3 lg:py-4 whitespace-nowrap leading-tight md:leading-snug lg:leading-normal">
                                <span 
                                    className={`px-2 md:px-2.5 lg:px-3 py-0.5 md:py-0.5 lg:py-1 rounded-full text-[10px] md:text-[11px] lg:text-xs font-medium leading-tight md:leading-snug lg:leading-normal ${
                                        subtype.status === 'active' 
                                            ? 'bg-[#DCFCE7] text-[#1D8C1D]' 
                                            : 'bg-[#E3E3E3] text-[#8A8A8A]'
                                    }`}
                                >
                                    {subtype.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-2 md:px-3 lg:px-4 py-2 md:py-3 lg:py-4 whitespace-nowrap text-xs md:text-sm lg:text-sm text-[#515151] leading-tight md:leading-snug lg:leading-normal">
                                {subtype.quizCount}
                            </td>
                            <td className="px-2 md:px-3 lg:px-4 py-2 md:py-3 lg:py-4 whitespace-nowrap text-xs md:text-sm lg:text-sm leading-tight md:leading-snug lg:leading-normal">
                                <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
                                    <button
                                        onClick={() => onEdit(subtype)}
                                        className="p-0.5 md:p-0.5 lg:p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-3 h-3 md:w-4 md:h-4 lg:w-4 lg:h-4" strokeWidth={2} color="#1A1A1A" />
                                    </button>
                                    <div className="h-3 md:h-3.5 lg:h-4 w-px bg-[#D5D5D5]"></div>
                                    <button
                                        onClick={() => onToggleStatus(subtype)}
                                        className={`whitespace-nowrap text-[10px] md:text-xs lg:text-xs font-medium transition-colors cursor-pointer leading-tight md:leading-snug lg:leading-normal ${
                                            subtype.status === 'active' 
                                                ? 'text-[#D8201D] hover:opacity-80' 
                                                : 'text-[#22A121] hover:opacity-80'
                                        }`}
                                    >
                                        {subtype.status === 'active' ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {subtypes.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-2 md:px-3 lg:px-4 py-4 md:py-6 lg:py-8 text-center text-gray-500 text-xs md:text-sm lg:text-sm leading-tight md:leading-snug lg:leading-normal">
                                No subtypes found. Add one to get started.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default JewelrySubtypeTable;
