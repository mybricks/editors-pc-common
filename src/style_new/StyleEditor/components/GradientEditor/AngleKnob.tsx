import React, { useRef, useState, useEffect } from "react";
import css from "./AngleKnob.less";

interface AngleKnobProps {
    value: number;
    onChange: (value: number) => void;
    size?: number;
}

export const AngleKnob: React.FC<AngleKnobProps> = ({
    value,
    onChange,
    size = 90,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [displayAngle, setDisplayAngle] = useState(value);
    const [shouldTransition, setShouldTransition] = useState(true);
    const knobRef = useRef<HTMLDivElement>(null);
    const lastAngleRef = useRef(value);
    const rotationCountRef = useRef(0);
    const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const hasDraggedRef = useRef(false);
    const displayAngleRef = useRef(value);

    const calculateAngleFromPosition = (clientX: number, clientY: number) => {
        if (!knobRef.current) return null;

        const rect = knobRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;

        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        angle = (angle + 90 + 360) % 360;

        return Math.round(angle);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);

        const currentNormalized = ((displayAngle % 360) + 360) % 360;
        lastAngleRef.current = currentNormalized;
        displayAngleRef.current = displayAngle;

        hasDraggedRef.current = false;
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const calculateAngle = (e: MouseEvent) => {
        if (!knobRef.current) return;

        if (mouseDownPosRef.current && !hasDraggedRef.current) {
            const deltaX = e.clientX - mouseDownPosRef.current.x;
            const deltaY = e.clientY - mouseDownPosRef.current.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > 3) {
                hasDraggedRef.current = true;
            } else {
                return;
            }
        }

        const roundedAngle = calculateAngleFromPosition(e.clientX, e.clientY);
        if (roundedAngle === null) return;

        let diff = roundedAngle - lastAngleRef.current;

        if (diff > 180) {
            diff -= 360;
            rotationCountRef.current -= 1;
        } else if (diff < -180) {
            diff += 360;
            rotationCountRef.current += 1;
        }

        const newDisplayAngle = displayAngleRef.current + diff;

        displayAngleRef.current = newDisplayAngle;
        setDisplayAngle(newDisplayAngle);

        lastAngleRef.current = roundedAngle;
        onChange(roundedAngle);
    };

    const handleClick = (e: MouseEvent) => {
        if (hasDraggedRef.current) return;

        const clickedAngle = calculateAngleFromPosition(e.clientX, e.clientY);
        if (clickedAngle === null) return;

        const currentNormalized = ((displayAngle % 360) + 360) % 360;

        let diff = clickedAngle - currentNormalized;

        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }

        const newDisplayAngle = displayAngle + diff;

        setShouldTransition(true);
        setDisplayAngle(newDisplayAngle);
        displayAngleRef.current = newDisplayAngle;
        onChange(clickedAngle);
        lastAngleRef.current = clickedAngle;

        rotationCountRef.current = Math.floor(newDisplayAngle / 360);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                calculateAngle(e);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isDragging) {
                if (!hasDraggedRef.current) {
                    handleClick(e);
                } else {
                    const targetAngle = rotationCountRef.current * 360 + value;
                    setDisplayAngle(targetAngle);
                    displayAngleRef.current = targetAngle;
                }
            }
            setIsDragging(false);
            mouseDownPosRef.current = null;
            hasDraggedRef.current = false;
        };

        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging, value]);

    useEffect(() => {
        if (!isDragging) {
            const currentNormalized = ((displayAngle % 360) + 360) % 360;
            const diff = value - currentNormalized;

            let shortestDiff = diff;
            if (diff > 180) {
                shortestDiff = diff - 360;
            } else if (diff < -180) {
                shortestDiff = diff + 360;
            }

            const newDisplayAngle = displayAngle + shortestDiff;

            setShouldTransition(true);
            setDisplayAngle(newDisplayAngle);
            displayAngleRef.current = newDisplayAngle;
            lastAngleRef.current = value;

            rotationCountRef.current = Math.floor(newDisplayAngle / 360);
        }
    }, [value, isDragging]);

    useEffect(() => {
        displayAngleRef.current = displayAngle;
    }, [displayAngle]);

    const handleTransitionEnd = () => {
        if (!isDragging) {
            setShouldTransition(false);

            requestAnimationFrame(() => {
                const normalized = ((displayAngle % 360) + 360) % 360;
                setDisplayAngle(normalized);
                displayAngleRef.current = normalized;
                rotationCountRef.current = 0;
                lastAngleRef.current = normalized;
            });
        }
    };

    return (
        <div className={css.knobContainer}>
            <div
                ref={knobRef}
                className={css.knob}
                style={{ width: size, height: size }}
                onMouseDown={handleMouseDown}
            >
                <svg width={size} height={size} className={css.knobSvg}>
                    {/* 外圈 */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 - 2}
                        fill="transparent"
                        stroke="#E5E5E5"
                        strokeWidth="2"
                    />

                    {/* 刻度线 */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                        const angle = (deg - 90) * (Math.PI / 180);
                        const innerRadius = size / 2 - 8;
                        const outerRadius = size / 2 - 2;
                        const x1 = size / 2 + innerRadius * Math.cos(angle);
                        const y1 = size / 2 + innerRadius * Math.sin(angle);
                        const x2 = size / 2 + outerRadius * Math.cos(angle);
                        const y2 = size / 2 + outerRadius * Math.sin(angle);

                        return (
                            <line
                                key={deg}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#dbdbdbff"
                                strokeWidth="1"
                            />
                        );
                    })}
                </svg>

                {/* 箭头指针 */}
                <div
                    className={`${css.arrowPointer} ${isDragging ? css.dragging : ''} ${!shouldTransition ? css.noTransition : ''}`}
                    style={{
                        transform: `rotate(${displayAngle}deg)`,
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    {/* 箭头头部 */}
                    <svg className={css.arrowHead} width="12" height="8" viewBox="0 0 12 8">
                        <path
                            d="M 6 0 L 11 8 L 8 8 L 4 8 L 1 8 Z"
                            fill="#FA6400"
                        />
                    </svg>


                    {/* 箭头杆身 */}
                    <div className={css.arrowShaft} />
                </div>

                {/* 中心显示角度值 */}
                <div className={css.valueDisplay}>{value}°</div>
            </div>
        </div>
    );
};
