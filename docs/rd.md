# RD — computer-driver route

UINT16LE count; 14-byte records, all UINT16LE:

`x1,y1,x2,y2,angle,compass_direction,distance`

Connect consecutive endpoints to avoid teleporting. Angle: `atan2(dy,dx)*960/pi`, normalized modulo 1920. Compass: `int(angle/240.0+6.5)%8`. Distance: truncated Euclidean length. Angle/distance appear unused.

## Sources

- [Track formats](https://moddingwiki.shikadi.net/wiki/Wacky_Wheels_Track_Format)

Read on 2026-10-02. [Format index](README.md).
