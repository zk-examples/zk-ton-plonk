pragma circom 2.0.0;

include "Multiplier.circom";

template Reuse() {
    signal input a;
    signal input b;
    signal input c;

    signal output out;

    component multi1 = Multiplier();
    component multi2 = Multiplier();

    multi1.a <== a;
    multi1.b <== b;

    multi2.a <== multi1.c;
    multi2.b <== c;

    out <== multi2.c;
}

component main = Reuse();